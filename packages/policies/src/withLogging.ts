import type { Handler, Policy } from "@c4c/core";

/**
 * Logging policy for observability
 */
export function withLogging(procedureName: string): Policy {
	return <TInput, TOutput>(handler: Handler<TInput, TOutput>): Handler<TInput, TOutput> => {
		return async (input, context) => {
			console.log(`[${procedureName}] Starting execution`, {
				requestId: context.requestId,
				timestamp: context.timestamp.toISOString(),
			});

			const startTime = performance.now();

			try {
				const result = await handler(input, context);
				const duration = performance.now() - startTime;

				console.log(`[${procedureName}] Completed successfully`, {
					requestId: context.requestId,
					durationMs: duration.toFixed(2),
				});

				return result;
			} catch (error) {
				const duration = performance.now() - startTime;

				console.error(`[${procedureName}] Failed with error`, {
					requestId: context.requestId,
					durationMs: duration.toFixed(2),
					error: error instanceof Error ? error.message : String(error),
				});

				throw error;
			}
		};
	};
}
