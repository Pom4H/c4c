/**
 * Error types for Workflow DevKit
 *
 * FatalError - non-retryable, the workflow step has permanently failed
 * RetryableError - explicitly retryable with optional delay configuration
 */

import type { RetryableErrorOptions } from "./types.js";
import { parseDuration } from "./duration.js";

/**
 * A non-retryable error. When thrown from a step function,
 * the error will NOT be retried and will immediately propagate
 * to the workflow function's catch handler.
 *
 * @example
 * ```ts
 * async function processPayment(amount: number) {
 *   "use step";
 *   if (amount <= 0) {
 *     throw new FatalError("Invalid payment amount");
 *   }
 *   // ...
 * }
 * ```
 */
export class FatalError extends Error {
	readonly isFatal = true;

	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "FatalError";
	}
}

/**
 * An explicitly retryable error. When thrown from a step function,
 * the step will be retried after the specified delay.
 *
 * @example
 * ```ts
 * async function callExternalAPI() {
 *   "use step";
 *   const resp = await fetch("https://api.example.com/data");
 *   if (resp.status === 429) {
 *     throw new RetryableError("Rate limited", { retryAfter: "30s" });
 *   }
 *   return resp.json();
 * }
 * ```
 */
export class RetryableError extends Error {
	readonly isRetryable = true;
	readonly retryAfterMs: number;

	constructor(message: string, options?: RetryableErrorOptions) {
		super(message);
		this.name = "RetryableError";
		this.retryAfterMs = options?.retryAfter
			? parseDuration(options.retryAfter)
			: 1000;
	}
}
