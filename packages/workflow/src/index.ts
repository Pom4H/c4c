/**
 * @c4c/workflow - Workflow system with OpenTelemetry
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
  WorkflowPauseState,
  WhenFilterContext,
  TriggerConfig,
} from "./types.js";

export { executeWorkflow, resumeWorkflow, validateWorkflow } from "./runtime.js";

export { createSubworkflowProcedure } from "./subworkflow.js";

// Tracing helpers for visualization in apps/examples
export { SpanCollector } from "./span-collector.js";
export { bindCollector, forceFlush, clearActiveCollector } from "./otel.js";

// Realtime events for SSE/WebSocket integrations
export type { WorkflowEvent, SerializedWorkflowExecutionResult } from "./events.js";
export { subscribeToExecution, subscribeToAllExecutions } from "./events.js";

// Workflow library utilities
export {
	loadWorkflowLibrary,
	loadWorkflowDefinitionById,
	type WorkflowSummary,
} from "./library.js";

// Workflow builder API
export { workflow, step, parallel, condition, sequence, when } from "./builder.js";
export type { StepContext, ConditionContext } from "./builder.js";

// Re-export selected core types for app/example convenience
export type { Registry, Procedure } from "@c4c/core";

// Trigger Workflow Manager (simplified trigger approach)
export {
	TriggerWorkflowManager,
	createTriggerWorkflowManager,
} from "./trigger-manager.js";
export type {
	TriggerSubscription,
	DeployTriggerWorkflowOptions,
	WebhookEvent,
} from "./trigger-manager.js";

// Execution Store for monitoring and UI
export {
	ExecutionStore,
	getExecutionStore,
	setExecutionStore,
} from "./execution-store.js";
export type {
	ExecutionRecord,
	NodeExecutionDetail,
} from "./execution-store.js";
