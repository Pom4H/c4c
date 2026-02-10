/**
 * Workflow DevKit Types
 *
 * Inspired by useworkflow.dev (Vercel Workflow DevKit)
 * "use workflow" / "use step" directive-based durable workflow system
 */

/**
 * Metadata available inside a step function via getStepMetadata()
 */
export interface StepMetadata {
	/** Current attempt number (1-indexed). Increases on retries. */
	attempt: number;
	/** Maximum number of retry attempts */
	maxAttempts: number;
	/** The workflow run ID this step belongs to */
	workflowRunId: string;
	/** When the workflow started */
	workflowStartedAt: Date;
}

/**
 * Metadata available inside a workflow function via getWorkflowMetadata()
 */
export interface WorkflowMetadata {
	/** Unique identifier for this workflow run */
	workflowRunId: string;
	/** When the workflow was started */
	workflowStartedAt: Date;
}

/**
 * A running workflow instance returned by start()
 */
export interface WorkflowRun<T = unknown> {
	/** Unique identifier for this run */
	runId: string;
	/** Promise that resolves with the workflow result */
	result: Promise<T>;
	/** ReadableStream for consuming workflow output (for streaming use cases) */
	readable: ReadableStream<Uint8Array>;
	/** Current status of the workflow run */
	status: WorkflowRunStatus;
}

export type WorkflowRunStatus =
	| "running"
	| "completed"
	| "failed"
	| "suspended";

/**
 * Options for starting a workflow
 */
export interface StartOptions {
	/** Custom run ID (auto-generated if not provided) */
	runId?: string;
	/** Maximum number of retry attempts for steps (default: 3) */
	maxStepRetries?: number;
	/** Default retry delay in milliseconds (default: 1000) */
	retryDelay?: number;
}

/**
 * Hook that can be used to suspend a workflow until an external event
 */
export interface Hook<T = unknown> extends Promise<T> {
	/** Token that external systems use to resume this hook */
	token: string;
}

/**
 * Options for creating a hook
 */
export interface HookOptions {
	/** Token identifier for this hook */
	token: string;
	/** Timeout duration (e.g., "10m", "1h", 60000) */
	timeout?: string | number;
}

/**
 * Options for RetryableError
 */
export interface RetryableErrorOptions {
	/** When to retry (e.g., "5s", "1m", 5000) */
	retryAfter?: string | number;
}

/**
 * Event emitted during workflow execution
 */
export type WorkflowEvent =
	| {
		type: "workflow.started";
		runId: string;
		timestamp: number;
	}
	| {
		type: "workflow.completed";
		runId: string;
		result: unknown;
		executionTime: number;
		timestamp: number;
	}
	| {
		type: "workflow.failed";
		runId: string;
		error: string;
		executionTime: number;
		timestamp: number;
	}
	| {
		type: "step.started";
		runId: string;
		stepName: string;
		attempt: number;
		timestamp: number;
	}
	| {
		type: "step.completed";
		runId: string;
		stepName: string;
		attempt: number;
		result: unknown;
		timestamp: number;
	}
	| {
		type: "step.failed";
		runId: string;
		stepName: string;
		attempt: number;
		error: string;
		isFatal: boolean;
		timestamp: number;
	}
	| {
		type: "step.retrying";
		runId: string;
		stepName: string;
		attempt: number;
		nextAttempt: number;
		retryAfter: number;
		timestamp: number;
	}
	| {
		type: "workflow.suspended";
		runId: string;
		hookToken: string;
		timestamp: number;
	};
