/**
 * @tsdev/workflow - Workflow system with OpenTelemetry
 * 
 * Compose procedures into visual workflows with automatic tracing
 */

export type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowContext,
  WorkflowExecutionResult,
  TraceSpan,
  NodeMetadata,
  WorkflowUIConfig,
  ConditionConfig,
  ParallelConfig,
  SubWorkflowConfig,
  WorkflowResumeState,
} from "./types.js";

export { executeWorkflow, validateWorkflow, resumeWorkflow, PauseSignal } from "./runtime.js";

export { createSubworkflowProcedure } from "./subworkflow.js";

// Tracing helpers for visualization in apps/examples
export { SpanCollector } from "./span-collector.js";
export { bindCollector, forceFlush, clearActiveCollector } from "./otel.js";

// Re-export selected core types for app/example convenience
export type { Registry, Procedure } from "@tsdev/core";
