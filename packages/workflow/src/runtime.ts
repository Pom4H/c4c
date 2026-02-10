/**
 * Workflow Runtime
 *
 * Executes workflow functions with "use workflow" / "use step" semantics.
 * Provides automatic retry for steps, error handling, and event emission.
 *
 * This is the core execution engine inspired by useworkflow.dev (Vercel Workflow DevKit).
 *
 * Key concepts:
 * - Workflow functions ("use workflow"): Orchestrators that compose steps
 * - Step functions ("use step"): Individual units of work with retry semantics
 * - Standard JS patterns (Promise.all, Promise.race, try/catch) work naturally
 * - FatalError stops retries immediately
 * - RetryableError triggers a retry with configurable delay
 * - Regular errors are automatically retried up to maxAttempts
 */

import type { WorkflowRun, StartOptions, WorkflowEvent } from "./types.js";
import { FatalError, RetryableError } from "./errors.js";
import { runInWorkflowContext, updateWorkflowContext, getWorkflowContext } from "./context.js";
import { publishEvent } from "./events.js";

function generateRunId(): string {
	return `wfr_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Start a workflow function.
 *
 * Takes any async function marked with "use workflow" and executes it
 * with the workflow runtime providing durability, retry, and observability.
 *
 * @param workflowFn - The workflow function to execute
 * @param args - Arguments to pass to the workflow function
 * @param options - Execution options
 * @returns A WorkflowRun with runId, result promise, and readable stream
 *
 * @example
 * ```ts
 * import { start } from "@c4c/workflow";
 *
 * async function myWorkflow(name: string) {
 *   "use workflow";
 *   const greeting = await greet(name);
 *   return greeting;
 * }
 *
 * const run = await start(myWorkflow, ["World"]);
 * const result = await run.result;
 * ```
 */
export function start<TArgs extends unknown[], TResult>(
	workflowFn: (...args: TArgs) => Promise<TResult>,
	args?: TArgs,
	options?: StartOptions,
): WorkflowRun<TResult> {
	const runId = options?.runId ?? generateRunId();
	const startedAt = new Date();

	// Create a TransformStream for streaming output
	const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();

	// Create a promise that resolves when the workflow completes
	const resultPromise = executeWorkflow<TArgs, TResult>(
		workflowFn,
		args ?? ([] as unknown as TArgs),
		{
			runId,
			startedAt,
			writable,
			maxStepRetries: options?.maxStepRetries ?? 3,
			retryDelay: options?.retryDelay ?? 1000,
		},
	);

	const run: WorkflowRun<TResult> = {
		runId,
		result: resultPromise,
		readable,
		status: "running",
	};

	// Update status when the workflow completes
	resultPromise
		.then(() => {
			run.status = "completed";
		})
		.catch(() => {
			run.status = "failed";
		});

	return run;
}

interface ExecutionConfig {
	runId: string;
	startedAt: Date;
	writable: WritableStream<Uint8Array>;
	maxStepRetries: number;
	retryDelay: number;
}

async function executeWorkflow<TArgs extends unknown[], TResult>(
	workflowFn: (...args: TArgs) => Promise<TResult>,
	args: TArgs,
	config: ExecutionConfig,
): Promise<TResult> {
	const startTime = Date.now();

	publishEvent({
		type: "workflow.started",
		runId: config.runId,
		timestamp: startTime,
	});

	try {
		const result = await runInWorkflowContext(
			{
				runId: config.runId,
				startedAt: config.startedAt,
				writable: config.writable,
			},
			() => workflowFn(...args),
		);

		const executionTime = Date.now() - startTime;

		publishEvent({
			type: "workflow.completed",
			runId: config.runId,
			result,
			executionTime,
			timestamp: Date.now(),
		});

		// Close the writable stream
		try {
			const writer = config.writable.getWriter();
			await writer.close();
		} catch {
			// Stream may already be closed
		}

		return result;
	} catch (error) {
		const executionTime = Date.now() - startTime;

		publishEvent({
			type: "workflow.failed",
			runId: config.runId,
			error: error instanceof Error ? error.message : String(error),
			executionTime,
			timestamp: Date.now(),
		});

		// Close the writable stream on failure
		try {
			const writer = config.writable.getWriter();
			await writer.abort(error instanceof Error ? error : new Error(String(error)));
		} catch {
			// Stream may already be closed
		}

		throw error;
	}
}

/**
 * Create a step executor that wraps a function with retry semantics.
 *
 * This is called internally by the runtime when it encounters a step function.
 * In the useworkflow.dev paradigm, step functions are marked with "use step"
 * and automatically get retry behavior.
 *
 * Since we can't use compiler transforms to detect "use step" at runtime
 * (that requires SWC/build-time transformation), we provide `step()` as
 * an explicit wrapper that gives the same semantics.
 *
 * @param name - Step name for logging and tracing
 * @param fn - The step function to execute
 * @param options - Step options (maxAttempts, retryDelay)
 * @returns A function with the same signature but with retry semantics
 */
export function step<TArgs extends unknown[], TResult>(
	name: string,
	fn: (...args: TArgs) => Promise<TResult>,
	options?: { maxAttempts?: number; retryDelay?: number },
): (...args: TArgs) => Promise<TResult> {
	const maxAttempts = options?.maxAttempts ?? 3;
	const baseRetryDelay = options?.retryDelay ?? 1000;

	return async (...args: TArgs): Promise<TResult> => {
		let attempt = 0;

		while (true) {
			attempt++;

			// Update context with step metadata
			updateWorkflowContext({
				stepAttempt: attempt,
				stepName: name,
				maxAttempts,
			});

		const ctx = (() => {
			try {
				return getWorkflowContext();
			} catch {
				return undefined;
			}
		})();
		const runId = ctx?.runId ?? "unknown";

			publishEvent({
				type: "step.started",
				runId,
				stepName: name,
				attempt,
				timestamp: Date.now(),
			});

			try {
				const result = await fn(...args);

				publishEvent({
					type: "step.completed",
					runId,
					stepName: name,
					attempt,
					result,
					timestamp: Date.now(),
				});

				return result;
			} catch (error) {
				// FatalError - never retry
				if (error instanceof FatalError) {
					publishEvent({
						type: "step.failed",
						runId,
						stepName: name,
						attempt,
						error: error.message,
						isFatal: true,
						timestamp: Date.now(),
					});
					throw error;
				}

				// RetryableError - retry with specified delay
				if (error instanceof RetryableError) {
					if (attempt >= maxAttempts) {
						publishEvent({
							type: "step.failed",
							runId,
							stepName: name,
							attempt,
							error: error.message,
							isFatal: false,
							timestamp: Date.now(),
						});
						throw error;
					}

					const retryDelay = error.retryAfterMs;

					publishEvent({
						type: "step.retrying",
						runId,
						stepName: name,
						attempt,
						nextAttempt: attempt + 1,
						retryAfter: retryDelay,
						timestamp: Date.now(),
					});

					await new Promise((resolve) => setTimeout(resolve, retryDelay));
					continue;
				}

				// Regular error - retry with exponential backoff
				if (attempt >= maxAttempts) {
					publishEvent({
						type: "step.failed",
						runId,
						stepName: name,
						attempt,
						error: error instanceof Error ? error.message : String(error),
						isFatal: false,
						timestamp: Date.now(),
					});
					throw error;
				}

				const retryDelay = baseRetryDelay * 2 ** (attempt - 1);

				publishEvent({
					type: "step.retrying",
					runId,
					stepName: name,
					attempt,
					nextAttempt: attempt + 1,
					retryAfter: retryDelay,
					timestamp: Date.now(),
				});

				await new Promise((resolve) => setTimeout(resolve, retryDelay));
			}
		}
	};
}
