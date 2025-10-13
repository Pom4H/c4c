/**
 * Workflow Runtime Executor
 * 
 * Executes workflows composed of procedure nodes
 */

import { executeProcedure, createExecutionContext } from "../core/executor.js";
import type { Registry } from "../core/types.js";
import type {
	WorkflowDefinition,
	WorkflowContext,
	WorkflowExecutionResult,
	WorkflowNode,
	ConditionConfig,
	ParallelConfig,
} from "./types.js";

/**
 * Execute a workflow
 */
export async function executeWorkflow(
	workflow: WorkflowDefinition,
	registry: Registry,
	initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
	const executionId = `wf_exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
	const startTime = Date.now();

	const context: WorkflowContext = {
		workflowId: workflow.id,
		executionId,
		variables: { ...workflow.variables, ...initialInput },
		nodeOutputs: new Map(),
		startTime: new Date(),
	};

	const nodesExecuted: string[] = [];

	try {
		// Start execution from start node
		let currentNodeId: string | undefined = workflow.startNode;

		while (currentNodeId) {
			const node = workflow.nodes.find((n) => n.id === currentNodeId);
			if (!node) {
				throw new Error(`Node ${currentNodeId} not found in workflow`);
			}

			context.currentNode = currentNodeId;
			nodesExecuted.push(currentNodeId);

			// Execute node
			const nextNodeId = await executeNode(node, context, registry);
			currentNodeId = nextNodeId;
		}

		// Workflow completed successfully
		const outputs: Record<string, unknown> = {};
		for (const [nodeId, output] of context.nodeOutputs.entries()) {
			outputs[nodeId] = output;
		}

		return {
			executionId,
			status: "completed",
			outputs,
			executionTime: Date.now() - startTime,
			nodesExecuted,
		};
	} catch (error) {
		return {
			executionId,
			status: "failed",
			outputs: {},
			error: error instanceof Error ? error : new Error(String(error)),
			executionTime: Date.now() - startTime,
			nodesExecuted,
		};
	}
}

/**
 * Execute a single workflow node
 */
async function executeNode(
	node: WorkflowNode,
	context: WorkflowContext,
	registry: Registry
): Promise<string | undefined> {
	console.log(`[Workflow] Executing node: ${node.id} (type: ${node.type})`);

	switch (node.type) {
		case "procedure":
			return executeProcedureNode(node, context, registry);
		case "condition":
			return executeConditionNode(node, context);
		case "parallel":
			return executeParallelNode(node, context, registry);
		case "sequential":
			return executeSequentialNode(node, context);
		default:
			throw new Error(`Unknown node type: ${node.type}`);
	}
}

/**
 * Execute a procedure node
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

	// Execute procedure
	const execContext = createExecutionContext({
		transport: "workflow",
		workflowId: context.workflowId,
		executionId: context.executionId,
		nodeId: node.id,
	});

	const output = await executeProcedure(procedure, input, execContext);

	// Store output in context
	context.nodeOutputs.set(node.id, output);

	// Update context variables with output (for next nodes)
	Object.assign(context.variables, output);

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
	const config = node.config as ConditionConfig;
	if (!config?.expression) {
		throw new Error(`Condition node ${node.id} missing expression`);
	}

	// Evaluate condition expression
	const result = evaluateExpression(config.expression, context.variables);

	// Return appropriate branch
	return result ? config.trueBranch : config.falseBranch;
}

/**
 * Execute parallel nodes
 */
async function executeParallelNode(
	node: WorkflowNode,
	context: WorkflowContext,
	registry: Registry
): Promise<string | undefined> {
	const config = node.config as ParallelConfig;
	if (!config?.branches || config.branches.length === 0) {
		throw new Error(`Parallel node ${node.id} missing branches`);
	}

	// Execute all branches in parallel
	const branchPromises = config.branches.map(async (branchNodeId) => {
		// Create a copy of context for each branch
		const branchContext = { ...context };
		const branchNode = context.nodeOutputs.get(branchNodeId);
		if (!branchNode) {
			throw new Error(`Branch node ${branchNodeId} not found`);
		}
		return { branchNodeId, result: branchNode };
	});

	if (config.waitForAll) {
		await Promise.all(branchPromises);
	} else {
		await Promise.race(branchPromises);
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
