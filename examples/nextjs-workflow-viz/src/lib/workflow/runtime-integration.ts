/**
 * Workflow runtime integration with real tsdev framework
 */

import { executeWorkflow as executeWorkflowCore } from "@tsdev/workflow/runtime.js";
import { getRegistry } from "../registry";
import type { WorkflowDefinition as TsdevWorkflowDefinition } from "@tsdev/workflow/types.js";
import type { WorkflowDefinition, WorkflowExecutionResult, TraceSpan } from "./types";

/**
 * Convert OpenTelemetry span to our TraceSpan format
 */
function convertSpan(span: unknown): TraceSpan {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = span as any; // OTEL spans have complex typing, using any for conversion
  return {
    spanId: s.spanContext?.().spanId || s.spanId || "",
    traceId: s.spanContext?.().traceId || s.traceId || "",
    parentSpanId: s.parentSpanId,
    name: s.name,
    kind: s.kind?.toString() || "INTERNAL",
    startTime: typeof s.startTime === "number" 
      ? s.startTime 
      : s.startTime?.[0] * 1000 + s.startTime?.[1] / 1000000 || Date.now(),
    endTime: typeof s.endTime === "number"
      ? s.endTime
      : s.endTime?.[0] * 1000 + s.endTime?.[1] / 1000000 || Date.now(),
    duration: s.duration || 0,
    status: {
      code: s.status?.code === 1 ? "OK" : s.status?.code === 2 ? "ERROR" : "UNSET",
      message: s.status?.message,
    },
    attributes: s.attributes || {},
    events: s.events?.map((e: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evt = e as any;
      return {
        name: evt.name,
        timestamp: typeof evt.time === "number" 
          ? evt.time 
          : evt.time?.[0] * 1000 + evt.time?.[1] / 1000000 || Date.now(),
        attributes: evt.attributes,
      };
    }) || [],
  };
}

/**
 * Execute workflow using real tsdev framework
 */
export async function executeWorkflow(
  workflow: WorkflowDefinition,
  initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
  const registry = getRegistry();
  
  // Cast to tsdev type (they're compatible)
  const tsdevWorkflow = workflow as unknown as TsdevWorkflowDefinition;
  
  try {
    const result = await executeWorkflowCore(tsdevWorkflow, registry, initialInput);
    
    // Convert spans if available
    const spans: TraceSpan[] = [];
    if (result.spans && Array.isArray(result.spans)) {
      for (const span of result.spans) {
        try {
          spans.push(convertSpan(span));
        } catch (err) {
          console.warn("Failed to convert span:", err);
        }
      }
    }
    
    return {
      executionId: result.executionId,
      status: result.status,
      outputs: result.outputs,
      executionTime: result.executionTime,
      nodesExecuted: result.nodesExecuted,
      spans,
      error: result.error ? result.error.message : undefined,
    };
  } catch (error) {
    throw error;
  }
}
