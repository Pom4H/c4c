/**
 * Tracing and OpenTelemetry Types
 * 
 * Defines types for workflow tracing and span collection
 */

/**
 * OpenTelemetry span representation for visualization
 */
export interface TraceSpan {
	spanId: string;
	traceId: string;
	parentSpanId?: string;
	name: string;
	kind: string;
	startTime: number;
	endTime: number;
	duration: number;
	status: {
		code: "OK" | "ERROR" | "UNSET";
		message?: string;
	};
	attributes: Record<string, string | number | boolean>;
	events?: Array<{
		name: string;
		timestamp: number;
		attributes?: Record<string, unknown>;
	}>;
}