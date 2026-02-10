/**
 * @c4c/workflow - Workflow DevKit Integration
 *
 * Re-exports the Vercel Workflow DevKit (useworkflow.dev) primitives
 * and adds c4c-specific extensions for monitoring and HTTP integration.
 *
 * ## Architecture (from useworkflow.dev)
 *
 * The Workflow DevKit uses compiler directives to create durable workflows:
 *
 * - `"use workflow"` marks a function as a workflow orchestrator
 *   (runs in sandboxed VM for determinism)
 * - `"use step"` marks a function as a step with full Node.js access
 *   (retried automatically on failure)
 *
 * At build time, the SWC compiler transforms workflow files into three bundles:
 * - `flow.js` - Workflow orchestration (sandboxed)
 * - `step.js` - Step execution (full runtime)
 * - `webhook.js` - Webhook handling
 *
 * These are exposed via HTTP at `/.well-known/workflow/v1/` endpoints.
 *
 * ## Quick Start
 *
 * ```ts
 * import { sleep, createWebhook, FatalError } from "@c4c/workflow";
 *
 * export async function onboardUser(email: string) {
 *   "use workflow";
 *
 *   const user = await createUser(email);
 *   await sleep("5s");
 *   await sendWelcomeEmail(user);
 *   return user;
 * }
 *
 * async function createUser(email: string) {
 *   "use step";
 *   return { id: crypto.randomUUID(), email };
 * }
 *
 * async function sendWelcomeEmail(user: { id: string; email: string }) {
 *   "use step";
 *   console.log(`Welcome email sent to ${user.email}`);
 * }
 * ```
 *
 * See https://useworkflow.dev for full documentation.
 */

// ============================================================
// Re-exports from the Vercel Workflow DevKit (`workflow` npm package)
// ============================================================

// Error types - control retry behavior in step functions
export { FatalError, RetryableError } from "workflow";

// Hooks - for metadata access inside workflow/step functions
export { getStepMetadata, getWorkflowMetadata } from "workflow";

// Sleep - durable sleep within workflows
export { sleep } from "workflow";

// Writable stream - for streaming output from workflows
export { getWritable } from "workflow";

// Webhook - for creating webhook callbacks within workflows
export { createWebhook } from "workflow";

// Hook - for creating suspension hooks that wait for external events
export { createHook, defineHook } from "workflow";

// ============================================================
// c4c extensions - monitoring, events, execution tracking
// ============================================================

// Event system for real-time monitoring
export { subscribeToRun, subscribeToAll, publishEvent } from "./events.js";

// Execution store for run history
export { ExecutionStore, getExecutionStore, setExecutionStore } from "./execution-store.js";

// Duration parser utility
export { parseDuration } from "./duration.js";

// ============================================================
// Types
// ============================================================

export type {
	WorkflowEvent,
} from "./types.js";

export type {
	RunRecord,
	StepRecord,
} from "./execution-store.js";
