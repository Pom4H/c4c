/**
 * OpenTelemetry setup for the example app
 *
 * We install a lightweight OTEL tracer provider with a custom exporter that
 * forwards finished spans to the in-memory `SpanCollector` used by the UI.
 *
 * Design notes:
 * - Uses BasicTracerProvider + SimpleSpanProcessor (from sdk-trace-base)
 * - Uses AsyncLocalStorageContextManager for proper async context propagation
 * - Maintains a traceId → SpanCollector map so all child spans are routed to
 *   the correct collector instance for the current execution
 */

import type { TraceSpan } from "./types";
import { SpanCollector } from "./span-collector";

// These imports are runtime-only (server). Keep them inside try/catch in case
// the example is built without server modules in some environments.
let api: typeof import("@opentelemetry/api");
let sdk: typeof import("@opentelemetry/sdk-trace-base");
let asyncHooks: typeof import("@opentelemetry/context-async-hooks");

// Global singletons
let provider: import("@opentelemetry/sdk-trace-base").BasicTracerProvider | undefined;
let isInstalled = false;

// Map traceId → collector. This lets the exporter route spans correctly when
// multiple executions occur over time.
const traceIdToCollector = new Map<string, SpanCollector>();

// Fallback active collector (set before each execution). When the root span for
// a new trace is seen, we bind its traceId to this collector.
let currentActiveCollector: SpanCollector | undefined;

/** Convert OTEL HrTime to epoch milliseconds */
function hrTimeToMs(hr: [number, number]): number {
  return hr[0] * 1_000 + Math.floor(hr[1] / 1_000_000);
}

/** Map SpanStatusCode number to string code in our TraceSpan */
function statusCodeToString(code: number): "OK" | "ERROR" | "UNSET" {
  // 0=UNSET, 1=OK, 2=ERROR in OTEL API
  if (code === 1) return "OK";
  if (code === 2) return "ERROR";
  return "UNSET";
}

/** Map OTEL SpanKind number to string */
function spanKindToString(kind: number): string {
  switch (kind) {
    case 0:
      return "INTERNAL";
    case 1:
      return "SERVER";
    case 2:
      return "CLIENT";
    case 3:
      return "PRODUCER";
    case 4:
      return "CONSUMER";
    default:
      return "INTERNAL";
  }
}

/** Custom exporter that forwards spans to the in-memory SpanCollector */
class CollectorSpanExporter implements import("@opentelemetry/sdk-trace-base").SpanExporter {
  export(
    spans: import("@opentelemetry/sdk-trace-base").ReadableSpan[],
    resultCallback: (result: import("@opentelemetry/sdk-trace-base").ExportResult) => void
  ): void {
    try {
      for (const span of spans) {
        const spanContext = span.spanContext();
        const traceId = spanContext.traceId;

        // Bind trace to active collector on first seen root span if needed
        if (!traceIdToCollector.has(traceId) && currentActiveCollector) {
          traceIdToCollector.set(traceId, currentActiveCollector);
        }

        const collector = traceIdToCollector.get(traceId);
        if (!collector) {
          // No collector registered for this trace; skip exporting
          continue;
        }

        // Convert span to our TraceSpan model
        const startTime = hrTimeToMs(span.startTime as [number, number]);
        const endTime = hrTimeToMs(span.endTime as [number, number]);
        const duration = Math.max(0, endTime - startTime);
        const status = span.status;

        const attributes: Record<string, string | number | boolean> = {};
        for (const [key, value] of Object.entries(span.attributes || {})) {
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            attributes[key] = value;
          } else if (value != null) {
            // stringify arrays/objects for display
            try {
              attributes[key] = JSON.stringify(value);
            } catch {
              attributes[key] = String(value);
            }
          }
        }

        const events: TraceSpan["events"] = (span.events || []).map((evt) => ({
          name: evt.name,
          timestamp: hrTimeToMs(evt.time as [number, number]),
          attributes: evt.attributes,
        }));

        // Push as a complete span by starting and ending immediately in collector
        const spanId = collector.startSpan(span.name, attributes, span.parentSpanId);
        // Overwrite IDs/times to match OTEL
        const spansRef = (collector as any).spans as TraceSpan[];
        const created = spansRef[spansRef.length - 1];
        created.spanId = spanContext.spanId;
        created.traceId = traceId;
        created.kind = spanKindToString(span.kind);
        created.startTime = startTime;
        created.endTime = endTime;
        created.duration = duration;
        created.status = {
          code: statusCodeToString((status.code as unknown as number) ?? 0),
          message: status.message,
        };
        if (events && events.length > 0) {
          created.events = events;
        }
      }
      resultCallback({ code: 0 }); // ExportResultCode.SUCCESS
    } catch (err) {
      // Report failure but don't throw
      resultCallback({ code: 1, error: err as Error });
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

/** Install OTEL provider once for the process */
async function ensureProviderInstalled(): Promise<void> {
  if (isInstalled) return;

  // Lazy dynamic imports to avoid client bundling
  const apiModule = await import("@opentelemetry/api");
  api = apiModule as unknown as typeof import("@opentelemetry/api");
  const sdkModule = await import("@opentelemetry/sdk-trace-base");
  sdk = sdkModule as unknown as typeof import("@opentelemetry/sdk-trace-base");
  const asyncHooksModule = await import("@opentelemetry/context-async-hooks");
  asyncHooks = asyncHooksModule as unknown as typeof import("@opentelemetry/context-async-hooks");

  const { BasicTracerProvider, SimpleSpanProcessor } = sdk;
  const { context } = api;
  const { AsyncLocalStorageContextManager } = asyncHooks;

  provider = new BasicTracerProvider();
  provider.addSpanProcessor(new SimpleSpanProcessor(new CollectorSpanExporter()));

  // Install context manager for async propagation
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());

  // Make this the global tracer provider
  api.trace.setGlobalTracerProvider(provider);

  isInstalled = true;
}

/**
 * Bind a collector for the upcoming execution. The exporter will attach the
 * first seen traceId to this collector and route all subsequent spans.
 */
export async function bindCollector(collector: SpanCollector): Promise<void> {
  await ensureProviderInstalled();
  currentActiveCollector = collector;
}

/** Force-flush all pending spans */
export async function forceFlush(): Promise<void> {
  if (provider) {
    await provider.forceFlush();
  }
}

/** Clear the temporary active collector after use */
export function clearActiveCollector(): void {
  currentActiveCollector = undefined;
}

/** Expose for tests: reset all mappings */
export function __resetForTests(): void {
  traceIdToCollector.clear();
  currentActiveCollector = undefined;
}
