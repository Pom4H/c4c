/**
 * Event System Types
 * 
 * Defines types for real-time workflow events and monitoring
 */

import type { WorkflowResumeState, WorkflowExecutionResult } from "./workflow.js";

export type SerializedWorkflowExecutionResult = Omit<WorkflowExecutionResult, "error"> & {
	error?: {
		message: string;
		name?: string;
		stack?: string;
	};
};

export type WorkflowEvent =
	| {
			type: "workflow.started";
			workflowId: string;
			executionId: string;
			startTime: number;
		}
	| {
			type: "workflow.resumed";
			workflowId: string;
			executionId: string;
			timestamp: number;
		}
	| {
			type: "workflow.completed";
			workflowId: string;
			executionId: string;
			executionTime: number;
			nodesExecuted: string[];
		}
	| {
			type: "workflow.failed";
			workflowId: string;
			executionId: string;
			executionTime: number;
			nodesExecuted: string[];
			error: string;
		}
	| {
			type: "workflow.paused";
			workflowId: string;
			executionId: string;
			executionTime: number;
			nodesExecuted: string[];
			resumeState: WorkflowResumeState;
		}
	| {
			type: "node.started";
			workflowId: string;
			executionId: string;
			nodeId: string;
			nodeIndex?: number;
			timestamp: number;
		}
	| {
			type: "node.completed";
			workflowId: string;
			executionId: string;
			nodeId: string;
			nodeIndex?: number;
			nextNodeId?: string;
			timestamp: number;
			output?: unknown;
		}
	| {
			type: "workflow.result";
			workflowId: string;
			executionId: string;
			result: SerializedWorkflowExecutionResult;
		};