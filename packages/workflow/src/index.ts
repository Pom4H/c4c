/**
 * @c4c/workflow - Workflow system with OpenTelemetry
 * 
 * Compose procedures into visual workflows with automatic tracing
 */

// Core types
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
	TriggerConfig,
} from "./types/index.js";

// Workflow execution
export { executeWorkflow, validateWorkflow } from "./execution/index.js";

// Workflow builder API
export { workflow, step, parallel, condition, sequence } from "./builder/index.js";
export type { StepContext, ConditionContext } from "./builder/index.js";

// Tracing helpers for visualization in apps/examples
export { SpanCollector } from "./tracing/index.js";
export { bindCollector, forceFlush, clearActiveCollector } from "./tracing/index.js";

// Realtime events for SSE/WebSocket integrations
export type { WorkflowEvent, SerializedWorkflowExecutionResult } from "./events/index.js";
export { subscribeToExecution, subscribeToAllExecutions } from "./events/index.js";

// Workflow library utilities
export {
	loadWorkflowLibrary,
	loadWorkflowDefinitionById,
	type WorkflowSummary,
} from "./library/index.js";

// Trigger Workflow Manager (simplified trigger approach)
export {
	TriggerWorkflowManager,
	createTriggerWorkflowManager,
} from "./triggers/index.js";
export type {
	TriggerSubscription,
	DeployTriggerWorkflowOptions,
	WebhookEvent,
} from "./triggers/index.js";

// Subworkflow support
export { createSubworkflowProcedure } from "./triggers/index.js";

// Execution Store for monitoring and UI
export {
	ExecutionStore,
	getExecutionStore,
	setExecutionStore,
} from "./storage/index.js";
export type {
	ExecutionRecord,
	NodeExecutionDetail,
} from "./storage/index.js";

// Re-export selected core types for app/example convenience
export type { Registry, Procedure } from "@c4c/core";