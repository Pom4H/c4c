/**
 * Server-Sent Events types for workflow streaming
 */

import type { WorkflowExecutionResult } from "./types.js";

/**
 * SSE event types for workflow execution
 */
export type WorkflowSSEEventType =
	| "workflow-start"
	| "workflow-progress"
	| "workflow-complete"
	| "workflow-error";

/**
 * Base SSE event structure
 */
export interface WorkflowSSEEventBase {
	timestamp: number;
}

/**
 * Workflow start event
 */
export interface WorkflowStartEvent extends WorkflowSSEEventBase {
	type: "start";
	workflowId: string;
	workflowName: string;
}

/**
 * Node execution progress event
 */
export interface WorkflowProgressEvent extends WorkflowSSEEventBase {
	type: "node-executed";
	nodeId: string;
}

/**
 * Workflow completion event
 */
export interface WorkflowCompleteEvent extends WorkflowSSEEventBase {
	type: "complete";
	result: WorkflowExecutionResult;
}

/**
 * Workflow error event
 */
export interface WorkflowErrorEvent extends WorkflowSSEEventBase {
	type: "error";
	error: string;
}

/**
 * Union of all SSE event types
 */
export type WorkflowSSEEvent =
	| WorkflowStartEvent
	| WorkflowProgressEvent
	| WorkflowCompleteEvent
	| WorkflowErrorEvent;

/**
 * SSE event data for sending
 */
export interface SSEEventData {
	data: string;
	event: WorkflowSSEEventType;
	id?: string;
	retry?: number;
}
