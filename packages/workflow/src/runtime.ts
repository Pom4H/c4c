/**
 * Workflow Runtime Executor
 * 
 * Executes workflows composed of procedure nodes
 * Fully integrated with OpenTelemetry tracing
 */

import { trace, type Span, SpanStatusCode, context as otelContext } from "@opentelemetry/api";
import { executeProcedure, createExecutionContext, type Registry } from "@tsdev/core";
import type {
	WorkflowDefinition,
	WorkflowContext,
	WorkflowExecutionResult,
	WorkflowNode,
	ConditionConfig,
	ParallelConfig,
  WorkflowResumeState,
} from "./types.js";
import { publish } from "./events.js";

const tracer = trace.getTracer("tsdev.workflow");

/**
 * Signal to pause workflow execution gracefully.
 * Throw this from a procedure to pause and persist state for later resume.
 */
export class PauseSignal extends Error {
  constructor(readonly reason: string, readonly data?: unknown) {
    super(reason);
    this.name = "PauseSignal";
  }
}

/**
 * Execute a workflow with full OpenTelemetry tracing
 * Creates a parent span for the entire workflow with child spans for each node
 */
export async function executeWorkflow(
	workflow: WorkflowDefinition,
	registry: Registry,
	initialInput: Record<string, unknown> = {},
	options?: { executionId?: string }
): Promise<WorkflowExecutionResult> {
	const executionId = options?.executionId ?? `wf_exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
	const startTime = Date.now();

	// Create workflow-level span
	return tracer.startActiveSpan(
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

			// Publish workflow started
			publish({
				type: "workflow.started",
				workflowId: workflow.id,
				executionId,
				startTime,
			});

			try {
				// Start execution from start node
				let currentNodeId: string | undefined = workflow.startNode;
				let nodeIndex = 0;

				while (currentNodeId) {
					const node = workflow.nodes.find((n) => n.id === currentNodeId);
					if (!node) {
						throw new Error(`Node ${currentNodeId} not found in workflow`);
					}

					workflowContext.currentNode = currentNodeId;
					nodesExecuted.push(currentNodeId);

					// Add workflow execution attributes
					workflowSpan.setAttributes({
						"workflow.current_node": currentNodeId,
						"workflow.current_node_index": nodeIndex,
						"workflow.nodes_executed": nodesExecuted.length,
					});

					// Publish node started
					publish({
						type: "node.started",
						workflowId: workflow.id,
						executionId,
						nodeId: currentNodeId,
						nodeIndex,
						timestamp: Date.now(),
					});

					// Execute node (creates its own span)
					const nextNodeId = await executeNode(node, workflowContext, registry, workflow);

					// Publish node completed
					publish({
						type: "node.completed",
						workflowId: workflow.id,
						executionId,
						nodeId: node.id,
						nodeIndex,
						nextNodeId: nextNodeId,
						timestamp: Date.now(),
					});
					currentNodeId = nextNodeId;
					nodeIndex++;
				}

				// Workflow completed successfully
				const outputs: Record<string, unknown> = {};
				for (const [nodeId, output] of workflowContext.nodeOutputs.entries()) {
					outputs[nodeId] = output;
				}

				const executionTime = Date.now() - startTime;

				// Set success attributes
				workflowSpan.setAttributes({
					"workflow.status": "completed",
					"workflow.nodes_executed_total": nodesExecuted.length,
					"workflow.execution_time_ms": executionTime,
				});
				workflowSpan.setStatus({ code: SpanStatusCode.OK });

				console.log(
					`[Workflow] ✅ Completed: ${workflow.id} (${executionTime}ms, ${nodesExecuted.length} nodes)`
				);

				// Publish workflow completed
				publish({
					type: "workflow.completed",
					workflowId: workflow.id,
					executionId,
					executionTime,
					nodesExecuted,
				});

				return {
					executionId,
					status: "completed" as const,
					outputs,
					executionTime,
					nodesExecuted,
				};
			} catch (error) {
				if (error instanceof PauseSignal) {
					const executionTime = Date.now() - startTime;
					// Prepare partial outputs
					const outputs: Record<string, unknown> = {};
					for (const [nodeId, output] of workflowContext.nodeOutputs.entries()) {
						outputs[nodeId] = output;
					}

					// Mark span as paused
					workflowSpan.setAttributes({
						"workflow.status": "paused",
						"workflow.nodes_executed_total": nodesExecuted.length,
						"workflow.execution_time_ms": executionTime,
						"workflow.pause.reason": error.reason,
					});
					workflowSpan.setStatus({ code: SpanStatusCode.UNSET });

					console.log(
						`[Workflow] ⏸️ Paused: ${workflow.id} (${executionTime}ms, ${nodesExecuted.length} nodes) — ${error.reason}`
					);

					// Publish workflow paused
					publish({
						type: "workflow.paused",
						workflowId: workflow.id,
						executionId,
						executionTime,
						nodesExecuted,
						resumeState,
					});

					const resumeState: WorkflowResumeState = {
						workflowId: workflow.id,
						executionId,
						currentNode: workflowContext.currentNode || workflow.startNode,
						variables: { ...workflowContext.variables },
						nodeOutputs: Object.fromEntries(workflowContext.nodeOutputs.entries()),
						nodesExecuted: [...nodesExecuted],
					};

					return {
						executionId,
						status: "paused" as const,
						outputs,
						executionTime,
						nodesExecuted,
						resumeState,
					};
				}
				const executionTime = Date.now() - startTime;

				// Set error attributes
				workflowSpan.setAttributes({
					"workflow.status": "failed",
					"workflow.nodes_executed_total": nodesExecuted.length,
					"workflow.execution_time_ms": executionTime,
					"workflow.error": error instanceof Error ? error.message : String(error),
				});
				workflowSpan.recordException(error instanceof Error ? error : new Error(String(error)));
				workflowSpan.setStatus({
					code: SpanStatusCode.ERROR,
					message: error instanceof Error ? error.message : String(error),
				});

				console.error(
					`[Workflow] ❌ Failed: ${workflow.id} (${executionTime}ms, ${nodesExecuted.length} nodes)`,
					error
				);

				// Publish workflow failed
				publish({
					type: "workflow.failed",
					workflowId: workflow.id,
					executionId,
					executionTime,
					nodesExecuted,
					error: error instanceof Error ? error.message : String(error),
				});

				return {
					executionId,
					status: "failed" as const,
					outputs: {},
					error: error instanceof Error ? error : new Error(String(error)),
					executionTime,
					nodesExecuted,
				};
			} finally {
				workflowSpan.end();
			}
		}
	);
}

/**
 * Resume a previously paused workflow from a serialized state
 */
export async function resumeWorkflow(
  workflow: WorkflowDefinition,
  registry: Registry,
  resumeState: WorkflowResumeState,
  variablesDelta: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
  const startTime = Date.now();

  return tracer.startActiveSpan(
    `workflow.resume`,
    {
      attributes: {
        "workflow.id": workflow.id,
        "workflow.name": workflow.name,
        "workflow.version": workflow.version,
        "workflow.execution_id": resumeState.executionId,
        "workflow.start_node": resumeState.currentNode,
        "workflow.node_count": workflow.nodes.length,
      },
    },
    async (workflowSpan: Span) => {
      const workflowContext: WorkflowContext = {
        workflowId: workflow.id,
        executionId: resumeState.executionId,
        variables: { ...workflow.variables, ...resumeState.variables, ...variablesDelta },
        nodeOutputs: new Map(Object.entries(resumeState.nodeOutputs || {})),
        startTime: new Date(),
        currentNode: resumeState.currentNode,
      };

      const nodesExecuted: string[] = [...(resumeState.nodesExecuted || [])];

      try {
        let currentNodeId: string | undefined = resumeState.currentNode;
        let nodeIndex = nodesExecuted.length;

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

          const nextNodeId = await executeNode(node, workflowContext, registry, workflow);
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
          `[Workflow] ▶️ Resumed and completed: ${workflow.id} (${executionTime}ms, ${nodesExecuted.length} nodes)`
        );

        return {
          executionId: resumeState.executionId,
          status: "completed" as const,
          outputs,
          executionTime,
          nodesExecuted,
        };
      } catch (error) {
        if (error instanceof PauseSignal) {
          const executionTime = Date.now() - startTime;
          const outputs: Record<string, unknown> = {};
          for (const [nodeId, output] of workflowContext.nodeOutputs.entries()) {
            outputs[nodeId] = output;
          }

          workflowSpan.setAttributes({
            "workflow.status": "paused",
            "workflow.nodes_executed_total": nodesExecuted.length,
            "workflow.execution_time_ms": executionTime,
            "workflow.pause.reason": error.reason,
          });
          workflowSpan.setStatus({ code: SpanStatusCode.UNSET });

          const newResumeState: WorkflowResumeState = {
            workflowId: workflow.id,
            executionId: resumeState.executionId,
            currentNode: workflowContext.currentNode || resumeState.currentNode,
            variables: { ...workflowContext.variables },
            nodeOutputs: Object.fromEntries(workflowContext.nodeOutputs.entries()),
            nodesExecuted: [...nodesExecuted],
          };

          console.log(
            `[Workflow] ⏸️ Paused after resume: ${workflow.id} (${executionTime}ms, ${nodesExecuted.length} nodes) — ${error.reason}`
          );

          return {
            executionId: resumeState.executionId,
            status: "paused" as const,
            outputs,
            executionTime,
            nodesExecuted,
            resumeState: newResumeState,
          };
        }

        const executionTime = Date.now() - startTime;
        workflowSpan.setAttributes({
          "workflow.status": "failed",
          "workflow.nodes_executed_total": nodesExecuted.length,
          "workflow.execution_time_ms": executionTime,
          "workflow.error": error instanceof Error ? error.message : String(error),
        });
        workflowSpan.recordException(error instanceof Error ? error : new Error(String(error)));
        workflowSpan.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });

        console.error(
          `[Workflow] ❌ Failed after resume: ${workflow.id} (${executionTime}ms, ${nodesExecuted.length} nodes)`,
          error
        );

        return {
          executionId: resumeState.executionId,
          status: "failed" as const,
          outputs: {},
          error: error instanceof Error ? error : new Error(String(error)),
          executionTime,
          nodesExecuted,
        };
      } finally {
        workflowSpan.end();
      }
    }
  );
}

/**
 * Execute a single workflow node with its own span
 */
async function executeNode(
	node: WorkflowNode,
	context: WorkflowContext,
	registry: Registry,
	workflow: WorkflowDefinition
): Promise<string | undefined> {
	// Create span for node execution
	return tracer.startActiveSpan(
		`workflow.node.${node.type}`,
		{
			attributes: {
				"workflow.id": workflow.id,
				"workflow.execution_id": context.executionId,
				"node.id": node.id,
				"node.type": node.type,
				...(node.procedureName && { "node.procedure": node.procedureName }),
			},
		},
		async (nodeSpan: Span) => {
			try {
				console.log(
					`[Workflow] 🔷 Executing node: ${node.id} (type: ${node.type}${node.procedureName ? `, procedure: ${node.procedureName}` : ""})`
				);

				// Publish started for any node (including parallel branches)
				publish({
					type: "node.started",
					workflowId: workflow.id,
					executionId: context.executionId,
					nodeId: node.id,
					timestamp: Date.now(),
				});

				let nextNodeId: string | undefined;

				switch (node.type) {
					case "procedure":
						nextNodeId = await executeProcedureNode(node, context, registry);
						break;
					case "condition":
						nextNodeId = await executeConditionNode(node, context);
						break;
					case "parallel":
						nextNodeId = await executeParallelNode(node, context, registry, workflow);
						break;
					case "sequential":
						nextNodeId = await executeSequentialNode(node, context);
						break;
					default:
						throw new Error(`Unknown node type: ${node.type}`);
				}

				// Set success attributes
				nodeSpan.setAttributes({
					"node.status": "completed",
					...(nextNodeId && { "node.next": nextNodeId }),
				});
				nodeSpan.setStatus({ code: SpanStatusCode.OK });

				console.log(`[Workflow] ✅ Node completed: ${node.id}${nextNodeId ? ` → ${nextNodeId}` : " (end)"}`);

				// Publish completed for any node
				publish({
					type: "node.completed",
					workflowId: workflow.id,
					executionId: context.executionId,
					nodeId: node.id,
					nextNodeId,
					timestamp: Date.now(),
				});

				return nextNodeId;
			} catch (error) {
				// Set error attributes
				nodeSpan.setAttributes({
					"node.status": "failed",
					"node.error": error instanceof Error ? error.message : String(error),
				});
				nodeSpan.recordException(error instanceof Error ? error : new Error(String(error)));
				nodeSpan.setStatus({
					code: SpanStatusCode.ERROR,
					message: error instanceof Error ? error.message : String(error),
				});

				console.error(`[Workflow] ❌ Node failed: ${node.id}`, error);

				// Handle error node if configured
				if (node.onError) {
					console.log(`[Workflow] 🔄 Redirecting to error handler: ${node.onError}`);
					return node.onError;
				}

				throw error;
			} finally {
				nodeSpan.end();
			}
		}
	);
}

/**
 * Execute a procedure node
 * The procedure itself will create its own spans via policies (withSpan)
 * This creates a hierarchy: workflow span → node span → procedure span → policy spans
 */
async function executeProcedureNode(
	node: WorkflowNode,
	context: WorkflowContext,
	registry: Registry
): Promise<string | undefined> {
	if (!node.procedureName) {
		throw new Error(`Procedure node ${node.id} missing procedureName`);
	}

	const procedure = registry.get(node.procedureName);
	if (!procedure) {
		throw new Error(`Procedure ${node.procedureName} not found in registry`);
	}

	// Build input from context variables and node config
	const input = buildNodeInput(node, context);

	// Execute procedure with workflow context metadata
	// This ensures the procedure's spans are children of the workflow node span
	const execContext = createExecutionContext({
		transport: "workflow",
		workflowId: context.workflowId,
		workflowName: context.workflowId, // Could be enhanced with actual workflow name
		executionId: context.executionId,
		nodeId: node.id,
		nodeProcedure: node.procedureName,
		registry, // expose registry to procedures (e.g., subworkflow runner)
	});

	// Add workflow-level attributes to the execution context
	// These will be picked up by the procedure's withSpan policy
	const activeSpan = trace.getActiveSpan();
	if (activeSpan) {
		activeSpan.setAttributes({
			"procedure.input": JSON.stringify(input),
		});
	}

	// Execute procedure - it will create its own span hierarchy
	const output = await executeProcedure(procedure, input, execContext);

	// Record output in the current span
	if (activeSpan) {
		activeSpan.setAttributes({
			"procedure.output": JSON.stringify(output),
			"procedure.output_keys": Object.keys(output as object).join(","),
		});
	}

	// Store output in context
	context.nodeOutputs.set(node.id, output);

	// Update context variables with output (for next nodes)
	Object.assign(context.variables, output);

	console.log(`[Workflow] 📤 Node ${node.id} output:`, Object.keys(output as object));

	// Return next node ID
	return typeof node.next === "string" ? node.next : node.next?.[0];
}

/**
 * Execute a condition node
 */
async function executeConditionNode(
	node: WorkflowNode,
	context: WorkflowContext
): Promise<string | undefined> {
	const config = node.config as unknown as ConditionConfig;
	if (!config?.expression) {
		throw new Error(`Condition node ${node.id} missing expression`);
	}

	// Add condition details to current span
	const activeSpan = trace.getActiveSpan();
	if (activeSpan) {
		activeSpan.setAttributes({
			"condition.expression": config.expression,
			"condition.variables": JSON.stringify(context.variables),
		});
	}

	// Evaluate condition expression
	const result = evaluateExpression(config.expression, context.variables);

	const nextBranch = result ? config.trueBranch : config.falseBranch;

	if (activeSpan) {
		activeSpan.setAttributes({
			"condition.result": result,
			"condition.branch_taken": nextBranch,
		});
	}

	console.log(
		`[Workflow] 🔀 Condition "${config.expression}" = ${result} → ${nextBranch}`
	);

	// Return appropriate branch
	return nextBranch;
}

/**
 * Execute parallel nodes
 * Each branch gets its own span
 */
async function executeParallelNode(
	node: WorkflowNode,
	context: WorkflowContext,
	registry: Registry,
	workflow: WorkflowDefinition
): Promise<string | undefined> {
	const config = node.config as unknown as ParallelConfig;
	if (!config?.branches || config.branches.length === 0) {
		throw new Error(`Parallel node ${node.id} missing branches`);
	}

	console.log(
		`[Workflow] 🔀 Executing ${config.branches.length} parallel branches (waitForAll: ${config.waitForAll})`
	);

	// Execute all branches in parallel
	const branchPromises = config.branches.map(async (branchNodeId, index) => {
		return tracer.startActiveSpan(
			`workflow.parallel.branch`,
			{
				attributes: {
					"workflow.id": workflow.id,
					"workflow.execution_id": context.executionId,
					"parallel.node_id": node.id,
					"parallel.branch_id": branchNodeId,
					"parallel.branch_index": index,
				},
			},
			async (branchSpan: Span) => {
				try {
					const branchNode = workflow.nodes.find((n) => n.id === branchNodeId);
					if (!branchNode) {
						throw new Error(`Branch node ${branchNodeId} not found`);
					}

					// Execute branch node
					await executeNode(branchNode, context, registry, workflow);

					branchSpan.setStatus({ code: SpanStatusCode.OK });
					return { branchNodeId, success: true };
				} catch (error) {
					branchSpan.recordException(error instanceof Error ? error : new Error(String(error)));
					branchSpan.setStatus({ code: SpanStatusCode.ERROR });
					throw error;
				} finally {
					branchSpan.end();
				}
			}
		);
	});

	if (config.waitForAll) {
		await Promise.all(branchPromises);
		console.log(`[Workflow] ✅ All ${config.branches.length} branches completed`);
	} else {
		await Promise.race(branchPromises);
		console.log(`[Workflow] ✅ First branch completed`);
	}

	// Return next node after parallel execution
	return typeof node.next === "string" ? node.next : node.next?.[0];
}

/**
 * Execute sequential nodes
 */
async function executeSequentialNode(
	node: WorkflowNode,
	context: WorkflowContext
): Promise<string | undefined> {
	// Sequential is just returning next node
	return typeof node.next === "string" ? node.next : node.next?.[0];
}

/**
 * Build input for a node from context and config
 */
function buildNodeInput(node: WorkflowNode, context: WorkflowContext): Record<string, unknown> {
	const input: Record<string, unknown> = {};

	// Start with node config
	if (node.config) {
		Object.assign(input, node.config);
	}

	// Add context variables (can override config)
	Object.assign(input, context.variables);

	return input;
}

/**
 * Evaluate a JavaScript expression in context
 */
function evaluateExpression(expression: string, variables: Record<string, unknown>): boolean {
	try {
		// Create a function with variables as parameters
		const func = new Function(...Object.keys(variables), `return ${expression}`);
		return func(...Object.values(variables));
	} catch (error) {
		console.error(`Error evaluating expression: ${expression}`, error);
		return false;
	}
}

/**
 * Validate workflow definition
 */
export function validateWorkflow(workflow: WorkflowDefinition, registry: Registry): string[] {
	const errors: string[] = [];

	// Check start node exists
	if (!workflow.nodes.find((n) => n.id === workflow.startNode)) {
		errors.push(`Start node ${workflow.startNode} not found`);
	}

	// Validate each node
	for (const node of workflow.nodes) {
		// Check procedure exists in registry
		if (node.type === "procedure" && node.procedureName) {
			if (!registry.has(node.procedureName)) {
				errors.push(`Node ${node.id}: procedure ${node.procedureName} not found in registry`);
			}
		}

		// Check next nodes exist
		const nextNodes = Array.isArray(node.next) ? node.next : node.next ? [node.next] : [];
		for (const nextId of nextNodes) {
			if (!workflow.nodes.find((n) => n.id === nextId)) {
				errors.push(`Node ${node.id}: next node ${nextId} not found`);
			}
		}
	}

	return errors;
}
