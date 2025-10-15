/**
 * OpenTelemetry setup & exporter for the framework.
 *
 * Exposes helpers to bind a SpanCollector for the current execution so that
 * spans produced by the runtime and procedures can be visualized in apps.
 */

import type { TraceSpan } from "./types.js";
import { SpanCollector } from "./span-collector.js";
import type { SpanExporter, ReadableSpan } from "@opentelemetry/sdk-trace-base";

let api: typeof import("@opentelemetry/api");
let sdk: typeof import("@opentelemetry/sdk-trace-base");
let asyncHooks: typeof import("@opentelemetry/context-async-hooks");

let provider: import("@opentelemetry/sdk-trace-base").BasicTracerProvider | undefined;
let isInstalled = false;

const traceIdToCollector = new Map<string, SpanCollector>();
let currentActiveCollector: SpanCollector | undefined;

function hrTimeToMs(hr: [number, number]): number {
  return hr[0] * 1_000 + Math.floor(hr[1] / 1_000_000);
}

function statusCodeToString(code: number | undefined): "OK" | "ERROR" | "UNSET" {
  if (code === 1) return "OK";
  if (code === 2) return "ERROR";
  return "UNSET";
}

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

class CollectorSpanExporter implements SpanExporter {
  export(
    spans: ReadableSpan[],
    resultCallback: (result: { code: number; error?: Error }) => void
  ): void {
    try {
      for (const span of spans) {
        const spanContext = span.spanContext();
        const traceId = spanContext.traceId;

        if (!traceIdToCollector.has(traceId) && currentActiveCollector) {
          traceIdToCollector.set(traceId, currentActiveCollector);
        }

        const collector = traceIdToCollector.get(traceId);
        if (!collector) continue;

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
            try {
              attributes[key] = JSON.stringify(value);
            } catch {
              attributes[key] = String(value);
            }
          }
        }

        const events: TraceSpan["events"] = (span.events || []).map((evt: any) => ({
          name: evt.name,
          timestamp: hrTimeToMs(evt.time as [number, number]),
          attributes: evt.attributes,
        }));

        // Push as a complete span by starting and ending immediately in collector
        collector.startSpan(span.name, attributes, span.parentSpanId);
        const spansRef = (collector as any).spans as TraceSpan[];
        const created = spansRef[spansRef.length - 1];
        created.spanId = spanContext.spanId;
        created.traceId = traceId;
        created.kind = spanKindToString(span.kind);
        created.startTime = startTime;
        created.endTime = endTime;
        created.duration = duration;
        created.status = {
          code: statusCodeToString(status?.code as unknown as number),
          message: status?.message,
        };
        if (events && events.length > 0) created.events = events;
      }
      resultCallback({ code: 0 });
    } catch (err) {
      resultCallback({ code: 1, error: err as Error });
    }
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

async function ensureProviderInstalled(): Promise<void> {
  if (isInstalled) return;
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

  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  api.trace.setGlobalTracerProvider(provider);
  isInstalled = true;
}

export async function bindCollector(collector: SpanCollector): Promise<void> {
  await ensureProviderInstalled();
  currentActiveCollector = collector;
}

export async function forceFlush(): Promise<void> {
  if (provider) await provider.forceFlush();
}

export function clearActiveCollector(): void {
  currentActiveCollector = undefined;
}

export { SpanCollector };
