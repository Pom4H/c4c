/**
 * tsdev - Contracts-first framework
 * 
 * Main entry point for the framework
 */

// Core
export * from "./core/index.js";

// Policies
export * from "./policies/index.js";

// Adapters
export { createHttpServer } from "./adapters/http.js";
export { runCli } from "./adapters/cli.js";
export { handleRESTRequest, listRESTRoutes } from "./adapters/rest.js";

// Generators
export { generateOpenAPISpec, generateOpenAPIJSON, generateOpenAPIYAML } from "./generators/openapi.js";

// Workflow
export type { WorkflowDefinition, WorkflowNode, WorkflowContext, WorkflowExecutionResult, NodeMetadata } from "./workflow/types.js";
export { executeWorkflow, validateWorkflow } from "./workflow/runtime.js";
export { generateWorkflowUI, generateWorkflowHTML, generateReactFlowConfig, generateN8NConfig, generateMermaidDiagram } from "./workflow/generator.js";
export { handleWorkflowRequest } from "./adapters/workflow-http.js";
