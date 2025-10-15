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
