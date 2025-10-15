/**
 * Workflow system types
 * 
 * Procedures with input/output contracts become workflow nodes automatically!
 */

import type { z } from "zod";

/**
 * Workflow node - automatically generated from Procedure
 */
export interface WorkflowNode {
	id: string;
	type: "procedure" | "condition" | "parallel" | "sequential";
	procedureName?: string; // Reference to registered procedure
	config?: Record<string, unknown>;
	next?: string | string[]; // Next node(s) to execute
	onError?: string; // Error handler node
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
	id: string;
	name: string;
	description?: string;
	version: string;
	nodes: WorkflowNode[];
	startNode: string;
	variables?: Record<string, unknown>; // Workflow-level variables
	metadata?: Record<string, unknown>;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
	workflowId: string;
	executionId: string;
	variables: Record<string, unknown>;
	nodeOutputs: Map<string, unknown>; // Store outputs from each node
	startTime: Date;
	currentNode?: string;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
	executionId: string;
  status: "completed" | "failed" | "cancelled" | "paused";
	outputs: Record<string, unknown>;
	error?: Error;
	executionTime: number;
	nodesExecuted: string[];
  spans?: TraceSpan[]; // Optional: for visualization purposes
  resumeState?: WorkflowResumeState; // Present when status === "paused"
}

/**
 * OpenTelemetry span representation for visualization
 */
export interface TraceSpan {
	spanId: string;
	traceId: string;
	parentSpanId?: string;
	name: string;
	kind: string;
	startTime: number;
	endTime: number;
	duration: number;
	status: {
		code: "OK" | "ERROR" | "UNSET";
		message?: string;
	};
	attributes: Record<string, string | number | boolean>;
	events?: Array<{
		name: string;
		timestamp: number;
		attributes?: Record<string, unknown>;
	}>;
}

/**
 * Node metadata for UI generation
 */
export interface NodeMetadata {
	id: string;
	name: string;
	description?: string;
	category: string;
	icon?: string;
	color?: string;
	inputSchema: z.ZodType;
	outputSchema: z.ZodType;
	configSchema?: z.ZodType; // Node-specific configuration
	examples?: Array<{
		input: unknown;
		output: unknown;
	}>;
}

/**
 * Workflow UI configuration
 */
export interface WorkflowUIConfig {
	nodes: NodeMetadata[];
	categories: string[];
	connections: Array<{
		from: string;
		to: string;
		fromPort?: string;
		toPort?: string;
	}>;
}

/**
 * Serialized state required to resume a paused workflow
 */
export interface WorkflowResumeState {
  workflowId: string;
  executionId: string;
  currentNode: string; // Node ID to resume from next
  variables: Record<string, unknown>;
  nodeOutputs: Record<string, unknown>; // Flattened Map<string, unknown>
  nodesExecuted: string[];
}

/**
 * Condition node configuration
 */
export interface ConditionConfig {
	expression: string; // JavaScript expression
	trueBranch: string; // Node ID for true
	falseBranch: string; // Node ID for false
}

/**
 * Parallel execution configuration
 */
export interface ParallelConfig {
	branches: string[]; // Node IDs to execute in parallel
	waitForAll: boolean; // Wait for all branches or first completion
}

/**
 * Sub-workflow runner configuration (for procedure-based subworkflow node)
 */
export interface SubWorkflowConfig {
  workflowId: string;
  input?: Record<string, unknown>;
  mergeOutputs?: boolean; // if true, return child outputs directly
}
