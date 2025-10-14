/**
 * Re-export core workflow runtime from framework
 * 
 * This file exists to provide a clean import path for the example
 * In a real app, you would import directly from the framework package
 */

// In a real app, this would be:
// export { executeWorkflow, validateWorkflow } from 'tsdev/core/workflow';

// For this monorepo example, we import from the source:
export { executeWorkflow, validateWorkflow } from "../../../../../src/core/workflow/runtime.js";
export type { WorkflowDefinition, WorkflowExecutionResult, WorkflowNode } from "../../../../../src/core/workflow/types.js";
