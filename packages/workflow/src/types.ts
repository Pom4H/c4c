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
	type: "procedure" | "condition" | "parallel" | "sequential" | "trigger" | "await";
	procedureName?: string; // Reference to registered procedure (for trigger nodes, this is the trigger procedure)
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
	/** If true, this workflow is triggered by external events and should not be run directly */
	isTriggered?: boolean;
	/** Trigger configuration for event-driven workflows */
	trigger?: TriggerConfig;
}

/**
 * Trigger configuration for event-driven workflows
 */
export interface TriggerConfig {
	/** Provider (e.g., "googleDrive", "slack") */
	provider: string;
	/** Trigger procedure name that creates the webhook subscription */
	triggerProcedure: string;
	/** Event type filter */
	eventType?: string;
	/** Additional subscription configuration */
	subscriptionConfig?: Record<string, unknown>;
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
 * Detailed pause state for workflow execution
 * Used by TriggerWorkflowManager to match incoming events to paused workflows
 */
export interface WorkflowPauseState extends WorkflowResumeState {
	/** Node ID where workflow is paused (await node) */
	pausedAt: string;
	/** What trigger(s) this workflow is waiting for */
	waitingFor: {
		procedures: string[];
		filter?: (event: unknown, context: WhenFilterContext) => boolean;
	};
	/** When the workflow was paused */
	pausedTime: Date;
	/** When the workflow should timeout (if configured) */
	timeoutAt?: Date;
}

/**
 * Context provided to filter functions in when() helper
 */
export interface WhenFilterContext {
	variables: Record<string, unknown>;
	nodeOutputs: Map<string, unknown>;
	executionId: string;
	workflowId: string;
}

/**
 * Condition node configuration
 */
export interface ConditionPredicateContext {
	variables: Record<string, unknown>;
	outputs: Map<string, unknown>;
	get<T = unknown>(key: string): T | undefined;
	inputData?: unknown;
}

export type ConditionPredicate = (context: ConditionPredicateContext) => boolean;
export type SwitchPredicate = (context: ConditionPredicateContext) => string | number;

/**
 * Condition configuration supporting both binary (true/false) and switch-case modes
 */
export interface ConditionConfig {
	// Binary mode (true/false)
	expression?: string; // JavaScript expression
	trueBranch?: string; // Node ID for true
	falseBranch?: string; // Node ID for false
	predicateFn?: ConditionPredicate; // Optional runtime predicate
	
	// Switch-case mode
	switchFn?: SwitchPredicate; // Returns case key
	cases?: Record<string | number, string>; // case key -> node ID
	defaultBranch?: string; // Default node ID if no case matches
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
