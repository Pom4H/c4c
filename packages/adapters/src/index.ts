/**
 * @c4c/adapters - HTTP server for Workflow DevKit
 *
 * Serves the three .well-known/workflow/v1/ endpoints
 * required by the Vercel Workflow DevKit runtime.
 */

export { createWorkflowServer, type WorkflowServerOptions } from "./server.js";
