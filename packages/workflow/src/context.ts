/**
 * Workflow execution context
 *
 * Uses AsyncLocalStorage to provide context to workflow and step functions
 * without explicit parameter passing.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { StepMetadata, WorkflowMetadata } from "./types.js";

interface WorkflowContext {
	runId: string;
	startedAt: Date;
	/** Current step attempt (set when inside a step) */
	stepAttempt?: number;
	/** Current step name (set when inside a step) */
	stepName?: string;
	/** Max attempts for the current step */
	maxAttempts?: number;
	/** WritableStream for streaming output */
	writable?: WritableStream<unknown>;
}

const workflowStorage = new AsyncLocalStorage<WorkflowContext>();

/**
 * Run a function within a workflow context
 */
export function runInWorkflowContext<T>(
	context: WorkflowContext,
	fn: () => T
): T {
	return workflowStorage.run(context, fn);
}

/**
 * Get the current workflow context (internal)
 */
export function getWorkflowContext(): WorkflowContext | undefined {
	return workflowStorage.getStore();
}

/**
 * Update the current workflow context (internal)
 */
export function updateWorkflowContext(
	updates: Partial<WorkflowContext>
): void {
	const ctx = workflowStorage.getStore();
	if (ctx) {
		Object.assign(ctx, updates);
	}
}

/**
 * Get metadata about the current step execution.
 *
 * Must be called inside a step function (marked with "use step").
 *
 * @example
 * ```ts
 * async function myStep() {
 *   "use step";
 *   const { attempt } = getStepMetadata();
 *   console.log(`Attempt ${attempt}`);
 * }
 * ```
 */
export function getStepMetadata(): StepMetadata {
	const ctx = workflowStorage.getStore();
	if (!ctx) {
		throw new Error(
			"getStepMetadata() must be called inside a step function within a workflow execution."
		);
	}

	return {
		attempt: ctx.stepAttempt ?? 1,
		maxAttempts: ctx.maxAttempts ?? 3,
		workflowRunId: ctx.runId,
		workflowStartedAt: ctx.startedAt,
	};
}

/**
 * Get metadata about the current workflow execution.
 *
 * Can be called inside a workflow function (marked with "use workflow")
 * or a step function.
 *
 * @example
 * ```ts
 * export async function myWorkflow() {
 *   "use workflow";
 *   const { workflowRunId } = getWorkflowMetadata();
 *   console.log(`Run ID: ${workflowRunId}`);
 * }
 * ```
 */
export function getWorkflowMetadata(): WorkflowMetadata {
	const ctx = workflowStorage.getStore();
	if (!ctx) {
		throw new Error(
			"getWorkflowMetadata() must be called inside a workflow or step function."
		);
	}

	return {
		workflowRunId: ctx.runId,
		workflowStartedAt: ctx.startedAt,
	};
}

/**
 * Get a WritableStream for streaming data from a workflow.
 *
 * @example
 * ```ts
 * export async function streamWorkflow() {
 *   "use workflow";
 *   const writable = getWritable<Uint8Array>();
 *   // Pass writable to steps for streaming
 * }
 * ```
 */
export function getWritable<T = Uint8Array>(): WritableStream<T> {
	const ctx = workflowStorage.getStore();
	if (!ctx) {
		throw new Error(
			"getWritable() must be called inside a workflow function."
		);
	}

	if (!ctx.writable) {
		throw new Error(
			"No writable stream is available. Ensure the workflow was started with streaming support."
		);
	}

	return ctx.writable as WritableStream<T>;
}
