import { trace, type Span } from "@opentelemetry/api";
import type { Handler, Policy } from "@c4c/core";

const tracer = trace.getTracer("c4c");

/**
 * OpenTelemetry tracing policy
 * Wraps handler execution in a span for observability
 */
export function withSpan(operationName: string, attributes: Record<string, unknown> = {}): Policy {
	return <TInput, TOutput>(handler: Handler<TInput, TOutput>): Handler<TInput, TOutput> => {
		return async (input, context) => {
			return tracer.startActiveSpan(operationName, async (span: Span) => {
				try {
					// Set default attributes
					span.setAttributes({
						"request.id": context.requestId,
						"request.timestamp": context.timestamp.toISOString(),
						...attributes,
					});

					// Add context metadata as attributes
					for (const [key, value] of Object.entries(context.metadata)) {
						if (typeof value === "string" || typeof value === "number") {
							span.setAttribute(`context.${key}`, value);
						}
					}

					const result = await handler(input, context);

					span.setStatus({ code: 1 }); // OK
					return result;
				} catch (error) {
					span.setStatus({
						code: 2, // ERROR
						message: error instanceof Error ? error.message : String(error),
					});
					span.recordException(error instanceof Error ? error : new Error(String(error)));
					throw error;
				} finally {
					span.end();
				}
			});
		};
	};
}
