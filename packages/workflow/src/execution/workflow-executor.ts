/**
 * Workflow Executor
 * 
 * Main workflow execution engine with OpenTelemetry tracing
 */

import { trace, type Span, SpanStatusCode } from "@opentelemetry/api";
import { inspect } from "node:util";
import { executeProcedure, createExecutionContext, type Registry } from "@c4c/core";
import type {
	WorkflowDefinition,
	WorkflowContext,
	WorkflowExecutionResult,
	WorkflowNode,
	ConditionConfig,
	ParallelConfig,
	ConditionPredicateContext,
	WorkflowResumeState,
} from "../types/index.js";
import { publish, type SerializedWorkflowExecutionResult } from "../events/index.js";
import { SpanCollector, bindCollector, forceFlush, clearActiveCollector } from "../tracing/index.js";
import { getExecutionStore } from "../storage/index.js";
import { executeNode } from "./node-executor.js";

const tracer = trace.getTracer("c4c.workflow");

/**
 * Execute a workflow with full OpenTelemetry tracing
 * Creates a parent span for the entire workflow with child spans for each node
 */
export async function executeWorkflow(
	workflow: WorkflowDefinition,
	registry: Registry,
	initialInput: Record<string, unknown> = {},
	options?: { executionId?: string; collector?: SpanCollector }
): Promise<WorkflowExecutionResult> {
	const executionId = options?.executionId ?? `wf_exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
	const startTime = Date.now();
	const collector = options?.collector ?? new SpanCollector();
	let collectorBound = false;

	try {
		await bindCollector(collector);
		collectorBound = true;
	} catch (error) {
		console.warn("[Workflow] Failed to initialize OpenTelemetry collector:", error);
	}

	// Start tracking execution in store
	const executionStore = getExecutionStore();
	executionStore.startExecution(
		executionId,
		workflow.id,
		workflow.name || workflow.id
	);

	const result = await tracer.startActiveSpan(
		`workflow.execute`,
		{
			attributes: {
				"workflow.id": workflow.id,
				"workflow.name": workflow.name,
				"workflow.version": workflow.version,
				"workflow.execution_id": executionId,
				"workflow.start_node": workflow.startNode,
				"workflow.node_count": workflow.nodes.length,
			},
		},
		async (workflowSpan: Span) => {
			const workflowContext: WorkflowContext = {
				workflowId: workflow.id,
				executionId,
				variables: { ...workflow.variables, ...initialInput },
				nodeOutputs: new Map(),
				startTime: new Date(),
			};

			const nodesExecuted: string[] = [];

			publish({
				type: "workflow.started",
				workflowId: workflow.id,
				executionId,
				startTime,
			});

			try {
				let currentNodeId: string | undefined = workflow.startNode;
				let nodeIndex = 0;

				while (currentNodeId) {
					const node = workflow.nodes.find((n) => n.id === currentNodeId);
					if (!node) {
						throw new Error(`Node ${currentNodeId} not found in workflow`);
					}

					workflowContext.currentNode = currentNodeId;
					nodesExecuted.push(currentNodeId);

					workflowSpan.setAttributes({
						"workflow.current_node": currentNodeId,
						"workflow.current_node_index": nodeIndex,
						"workflow.nodes_executed": nodesExecuted.length,
					});

					publish({
						type: "node.started",
						workflowId: workflow.id,
						executionId,
						nodeId: currentNodeId,
						nodeIndex,
						timestamp: Date.now(),
					});

					// Update node status in store
					executionStore.updateNodeStatus(executionId, currentNodeId, "running", {
						startTime: new Date(),
					});

					const nextNodeId = await executeNode(node, workflowContext, registry, workflow);

					// Get output for this node
					const nodeOutput = workflowContext.nodeOutputs.get(node.id);

					// Update node status in store
					executionStore.updateNodeStatus(executionId, node.id, "completed", {
						endTime: new Date(),
						output: nodeOutput,
					});

					publish({
						type: "node.completed",
						workflowId: workflow.id,
						executionId,
						nodeId: node.id,
						nodeIndex,
						nextNodeId,
						timestamp: Date.now(),
						output: nodeOutput,
					});

					currentNodeId = nextNodeId;
					nodeIndex++;
				}

				const outputs: Record<string, unknown> = {};
				for (const [nodeId, output] of workflowContext.nodeOutputs.entries()) {
					outputs[nodeId] = output;
				}

				const executionTime = Date.now() - startTime;

				workflowSpan.setAttributes({
					"workflow.status": "completed",
					"workflow.nodes_executed_total": nodesExecuted.length,
					"workflow.execution_time_ms": executionTime,
				});
				workflowSpan.setStatus({ code: SpanStatusCode.OK });

				console.log(
					`[Workflow] ✅ Completed: ${workflow.id} (${executionTime}ms, ${nodesExecuted.length} nodes)`
				);

				const workflowResult: WorkflowExecutionResult = {
					executionId,
					status: "completed",
					outputs,
					executionTime,
					nodesExecuted,
				};

				// Save execution result to store
				executionStore.completeExecution(executionId, workflowResult);

				publish({
					type: "workflow.completed",
					workflowId: workflow.id,
					executionId,
					executionTime,
					nodesExecuted,
				});

				return workflowResult;
			} catch (error) {
				const executionTime = Date.now() - startTime;
				const normalizedError = normalizeError(error);

				workflowSpan.setAttributes({
					"workflow.status": "failed",
					"workflow.nodes_executed_total": nodesExecuted.length,
					"workflow.execution_time_ms": executionTime,
					"workflow.error": normalizedError.message,
				});
				workflowSpan.recordException(normalizedError);
				workflowSpan.setStatus({
					code: SpanStatusCode.ERROR,
					message: normalizedError.message,
				});

				console.error(
					`[Workflow] ❌ Failed: ${workflow.id} (${executionTime}ms, ${nodesExecuted.length} nodes)`,
					normalizedError
				);

				const failureResult: WorkflowExecutionResult = {
					executionId,
					status: "failed",
					outputs: {},
					error: normalizedError,
					executionTime,
					nodesExecuted,
				};

				// Save failed execution to store
				executionStore.completeExecution(executionId, failureResult);

				publish({
					type: "workflow.failed",
					workflowId: workflow.id,
					executionId,
					executionTime,
					nodesExecuted,
					error: normalizedError.message,
				});

				return failureResult;
			} finally {
				workflowSpan.end();
			}
		}
	);

	if (collectorBound) {
		try {
			await forceFlush();
		} catch (flushError) {
			console.warn("[Workflow] Failed to flush collected spans:", flushError);
		}
		result.spans = collector.getSpans();
		clearActiveCollector();
	}

	result.spans ??= [];

	// Update execution in store with spans
	const execution = executionStore.getExecution(result.executionId);
	if (execution) {
		execution.spans = result.spans;
	}

	publish({
		type: "workflow.result",
		workflowId: workflow.id,
		executionId: result.executionId,
		result: toSerializedResult(result),
	});

	return result;
}

function normalizeError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	if (typeof Response !== "undefined" && error instanceof Response) {
		const statusText = error.statusText || "Response error";
		return new Error(`HTTP ${error.status}: ${statusText}`);
	}

	if (error && typeof error === "object") {
		const maybeMessage = (error as { message?: unknown }).message;
		const maybeName = (error as { name?: unknown }).name;

		let message: string | undefined;
		if (typeof maybeMessage === "string") {
			message = maybeMessage;
		} else if (maybeMessage !== undefined) {
			message = stringifyUnknown(maybeMessage);
		}

		if (!message) {
			message = stringifyUnknown(error);
		}

		const normalized = new Error(message);
		if (typeof maybeName === "string" && maybeName.length > 0) {
			normalized.name = maybeName;
		}
		return normalized;
	}

	return new Error(stringifyUnknown(error));
}

function stringifyUnknown(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (typeof value === "bigint") return value.toString();
	if (value === null || value === undefined) return String(value);

	try {
		return JSON.stringify(
			value,
			(_, v) => (typeof v === "bigint" ? v.toString() : v),
			2
		);
	} catch {
		return inspect(value, { depth: 5 });
	}
}

function toSerializedResult(result: WorkflowExecutionResult): SerializedWorkflowExecutionResult {
	const { error, ...rest } = result;
	return {
		...rest,
		error: error
			? {
					message: error.message,
					name: error.name,
					stack: error.stack,
				}
			: undefined,
	};
}