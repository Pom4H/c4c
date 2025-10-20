/**
 * @c4c/adapters - Transport adapters
 * 
 * HTTP, REST, CLI adapters for tsdev procedures
 */

export { createHttpServer, buildHttpApp } from "./http.js";
export type { HttpAppOptions } from "./http.js";
export { runCli } from "./cli.js";
export { createRestRouter, listRESTRoutes } from "./rest.js";
export { createWorkflowRouter, type WorkflowRouterOptions } from "./workflow-http.js";
export { createRpcRouter, extractAuthFromHeaders } from "./rpc.js";
