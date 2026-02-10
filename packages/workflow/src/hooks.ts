/**
 * Hook system for workflow suspension and resumption
 *
 * Hooks allow workflows to suspend and wait for external events.
 * This is useful for human-in-the-loop workflows, webhook callbacks,
 * and any pattern where the workflow needs to wait for external input.
 */

import type { Hook, HookOptions } from "./types.js";
import { parseDuration } from "./duration.js";
import { getWorkflowContext } from "./context.js";
import { publishEvent } from "./events.js";

/**
 * Registry of pending hooks waiting to be resolved
 */
const pendingHooks = new Map<
	string,
	{
		resolve: (value: unknown) => void;
		reject: (error: Error) => void;
		timeoutId?: ReturnType<typeof setTimeout>;
	}
>();

/**
 * Create a hook that suspends the workflow until resolved externally.
 *
 * The returned object is both a Promise (that resolves when the hook
 * is invoked) and has a `token` property that external systems can use
 * to resume the workflow.
 *
 * @example
 * ```ts
 * export async function approvalWorkflow() {
 *   "use workflow";
 *
 *   const hook = createHook<{ approved: boolean }>({
 *     token: `approval:${orderId}`,
 *     timeout: "24h",
 *   });
 *
 *   // Send approval email with hook.token...
 *   await sendApprovalEmail(hook.token);
 *
 *   // Workflow suspends here until hook is invoked
 *   const { approved } = await hook;
 *
 *   if (approved) {
 *     await processOrder();
 *   }
 * }
 * ```
 */
export function createHook<T = unknown>(options: HookOptions): Hook<T> {
	const { token, timeout } = options;

	const ctx = getWorkflowContext();
	if (ctx) {
		publishEvent({
			type: "workflow.suspended",
			runId: ctx.runId,
			hookToken: token,
			timestamp: Date.now(),
		});
	}

	const promise = new Promise<T>((resolve, reject) => {
		const entry: {
			resolve: (value: unknown) => void;
			reject: (error: Error) => void;
			timeoutId?: ReturnType<typeof setTimeout>;
		} = { resolve: resolve as (v: unknown) => void, reject };

		if (timeout) {
			const ms = parseDuration(timeout);
			entry.timeoutId = setTimeout(() => {
				pendingHooks.delete(token);
				reject(new Error(`Hook "${token}" timed out after ${ms}ms`));
			}, ms);
		}

		pendingHooks.set(token, entry);
	});

	// Create Hook object that is both a Promise and has a token
	const hook = promise as Hook<T>;
	Object.defineProperty(hook, "token", {
		value: token,
		writable: false,
		enumerable: true,
	});

	return hook;
}

/**
 * Resolve a pending hook with a payload.
 * This is called by external systems (webhooks, API routes, etc.)
 * to resume a suspended workflow.
 *
 * @param token - The hook token
 * @param payload - The data to resolve the hook with
 * @returns true if the hook was found and resolved, false otherwise
 */
export function resolveHook(token: string, payload: unknown): boolean {
	const entry = pendingHooks.get(token);
	if (!entry) {
		return false;
	}

	if (entry.timeoutId) {
		clearTimeout(entry.timeoutId);
	}

	pendingHooks.delete(token);
	entry.resolve(payload);
	return true;
}

/**
 * Reject a pending hook with an error.
 *
 * @param token - The hook token
 * @param error - The error to reject the hook with
 * @returns true if the hook was found and rejected, false otherwise
 */
export function rejectHook(token: string, error: Error): boolean {
	const entry = pendingHooks.get(token);
	if (!entry) {
		return false;
	}

	if (entry.timeoutId) {
		clearTimeout(entry.timeoutId);
	}

	pendingHooks.delete(token);
	entry.reject(error);
	return true;
}

/**
 * Check if a hook is pending
 */
export function isHookPending(token: string): boolean {
	return pendingHooks.has(token);
}

/**
 * Get all pending hook tokens
 */
export function getPendingHooks(): string[] {
	return Array.from(pendingHooks.keys());
}
