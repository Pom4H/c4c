import type { Handler, Policy } from "../core/types.js";

export interface RetryOptions {
	maxAttempts?: number;
	delayMs?: number;
	backoffMultiplier?: number;
}

/**
 * Retry policy with exponential backoff
 * Implements composable resilience pattern
 */
export function withRetry(options: RetryOptions = {}): Policy {
	const { maxAttempts = 3, delayMs = 100, backoffMultiplier = 2 } = options;

	return <TInput, TOutput>(handler: Handler<TInput, TOutput>): Handler<TInput, TOutput> => {
		return async (input, context) => {
			let lastError: Error | undefined;
			let currentDelay = delayMs;

			for (let attempt = 1; attempt <= maxAttempts; attempt++) {
				try {
					return await handler(input, context);
				} catch (error) {
					lastError = error instanceof Error ? error : new Error(String(error));

					if (attempt === maxAttempts) {
						break;
					}

					console.log(
						`[Retry] Attempt ${attempt}/${maxAttempts} failed, retrying in ${currentDelay}ms...`
					);

					await sleep(currentDelay);
					currentDelay *= backoffMultiplier;
				}
			}

			throw lastError;
		};
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
