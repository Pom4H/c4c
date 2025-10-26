/**
 * Core Workflow Types
 * 
 * Defines the fundamental workflow data structures
 */

import type { z } from "zod";
import type { TraceSpan } from "./tracing.js";

/**
 * Workflow node - automatically generated from Procedure
 */
export interface WorkflowNode {
	id: string;
	type: "procedure" | "condition" | "parallel" | "sequential" | "trigger";
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