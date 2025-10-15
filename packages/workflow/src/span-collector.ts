/**
 * Simple in-memory trace collector for visualization and tests.
 */
import type { TraceSpan } from "./types.js";

export class SpanCollector {
  private spans: TraceSpan[] = [];
  private currentSpanId = 0;
  private traceId: string;

  constructor(traceId?: string) {
    this.traceId = traceId ?? `trace_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  startSpan(
    name: string,
    attributes: Record<string, string | number | boolean> = {},
    parentSpanId?: string
  ): string {
    const spanId = `span_${++this.currentSpanId}`;
    const span: TraceSpan = {
      spanId,
      traceId: this.traceId,
      parentSpanId,
      name,
      kind: "INTERNAL",
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      status: { code: "UNSET" },
      attributes,
    };
    this.spans.push(span);
    return spanId;
  }

  endSpan(
    spanId: string,
    status: "OK" | "ERROR" = "OK",
    error?: string
  ): void {
    const span = this.spans.find((s) => s.spanId === spanId);
    if (span) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
      span.status = { code: status, message: error };
    }
  }

  addEvent(
    spanId: string,
    eventName: string,
    attributes?: Record<string, unknown>
  ): void {
    const span = this.spans.find((s) => s.spanId === spanId);
    if (span) {
      if (!span.events) span.events = [];
      span.events.push({
        name: eventName,
        timestamp: Date.now(),
        attributes,
      });
    }
  }

  getSpans(): TraceSpan[] {
    return [...this.spans];
  }

  getTraceId(): string {
    return this.traceId;
  }
}
