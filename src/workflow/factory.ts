/**
 * Factory functions for creating workflows
 */

import type { WorkflowDefinition, WorkflowNode } from "./types.js";

export interface SimpleWorkflowStep {
	procedureName: string;
	config?: Record<string, unknown>;
}

/**
 * Create a simple sequential workflow from procedure names
 * 
 * @example
 * ```typescript
 * const workflow = createSimpleWorkflow(
 *   "math-calc",
 *   "Math Calculation",
 *   [
 *     { procedureName: "math.add", config: { a: 10, b: 5 } },
 *     { procedureName: "math.multiply", config: { a: 2 } },
 *   ]
 * );
 * ```
 */
export function createSimpleWorkflow(
	id: string,
	name: string,
	steps: SimpleWorkflowStep[],
	options?: {
		description?: string;
		version?: string;
		variables?: Record<string, unknown>;
	}
): WorkflowDefinition {
	const nodes: WorkflowNode[] = steps.map((step, index) => ({
		id: `node_${index}`,
		type: "procedure" as const,
		procedureName: step.procedureName,
		config: step.config,
		next: index < steps.length - 1 ? `node_${index + 1}` : undefined,
	}));

	return {
		id,
		name,
		description: options?.description,
		version: options?.version || "1.0.0",
		nodes,
		startNode: "node_0",
		variables: options?.variables,
	};
}

/**
 * Create a workflow node
 */
export function createNode(
	id: string,
	type: WorkflowNode["type"],
	options: {
		procedureName?: string;
		config?: Record<string, unknown>;
		next?: string | string[];
		onError?: string;
	} = {}
): WorkflowNode {
	return {
		id,
		type,
		procedureName: options.procedureName,
		config: options.config,
		next: options.next,
		onError: options.onError,
	};
}

/**
 * Create a procedure node
 */
export function createProcedureNode(
	id: string,
	procedureName: string,
	config?: Record<string, unknown>,
	next?: string
): WorkflowNode {
	return {
		id,
		type: "procedure",
		procedureName,
		config,
		next,
	};
}

/**
 * Create a condition node
 */
export function createConditionNode(
	id: string,
	expression: string,
	trueBranch: string,
	falseBranch: string
): WorkflowNode {
	return {
		id,
		type: "condition",
		config: {
			expression,
			trueBranch,
			falseBranch,
		},
	};
}

/**
 * Create a parallel node
 */
export function createParallelNode(
	id: string,
	branches: string[],
	waitForAll = true,
	next?: string
): WorkflowNode {
	return {
		id,
		type: "parallel",
		config: {
			branches,
			waitForAll,
		},
		next,
	};
}
