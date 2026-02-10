/**
 * @c4c/workflow - Workflow DevKit
 *
 * Build durable, resilient, and observable workflows using plain TypeScript functions.
 * Inspired by useworkflow.dev (Vercel Workflow DevKit).
 *
 * ## Quick Start
 *
 * ```ts
 * import { start, step, FatalError } from "@c4c/workflow";
 *
 * // Define a step with retry semantics
 * const add = step("add", async (a: number, b: number) => {
 *   return a + b;
 * });
 *
 * // Define a workflow that composes steps
 * async function mathWorkflow(x: number) {
 *   "use workflow";
 *   const sum = await add(x, 10);
 *   const doubled = await add(sum, sum);
 *   return doubled;
 * }
 *
 * // Start the workflow
 * const run = start(mathWorkflow, [5]);
 * const result = await run.result; // 30
 * ```
 *
 * ## Key Concepts
 *
 * - **"use workflow"**: Marks a function as a workflow orchestrator
 * - **step()**: Wraps a function with retry semantics (replaces "use step")
 * - **FatalError**: Non-retryable error that stops the workflow
 * - **RetryableError**: Explicitly retryable error with configurable delay
 * - **sleep()**: Durable sleep within workflows
 * - **createHook()**: Suspend workflow until external event (webhooks, approvals)
 * - **start()**: Start a workflow and get back a run handle
 *
 * Standard JavaScript patterns work naturally:
 * - `Promise.all()` for parallel steps
 * - `Promise.race()` for racing steps
 * - `try/catch` for error handling
 * - Loops and conditionals for control flow
 */

// Error types
export { FatalError, RetryableError } from "./errors.js";

// Runtime
export { start, step } from "./runtime.js";

// Context / Metadata hooks
export { getStepMetadata, getWorkflowMetadata, getWritable } from "./context.js";

// Durable sleep
export { sleep } from "./sleep.js";

// Duration parser
export { parseDuration } from "./duration.js";

// Hook system (suspend/resume)
export { createHook, resolveHook, rejectHook, isHookPending, getPendingHooks } from "./hooks.js";

// Event system
export { subscribeToRun, subscribeToAll, publishEvent } from "./events.js";

// Execution store
export { ExecutionStore, getExecutionStore, setExecutionStore } from "./execution-store.js";

// Types
export type {
	WorkflowRun,
	WorkflowRunStatus,
	StartOptions,
	StepMetadata,
	WorkflowMetadata,
	Hook,
	HookOptions,
	RetryableErrorOptions,
	WorkflowEvent,
} from "./types.js";

export type {
	RunRecord,
	StepRecord,
} from "./execution-store.js";
