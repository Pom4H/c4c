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

// Realtime events for SSE/WebSocket integrations
export type { WorkflowEvent } from "./events.js";
export { subscribeToExecution } from "./events.js";

// Re-export selected core types for app/example convenience
export type { Registry, Procedure } from "@tsdev/core";

// Workflow collection utilities
export { collectWorkflows, listWorkflows, getWorkflowById } from "./workflow-collector.js";
