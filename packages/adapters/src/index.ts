/**
 * @c4c/adapters - Transport adapters
 * 
 * HTTP, REST, CLI adapters for c4c procedures
 */

export { createHttpServer, buildHttpApp } from "./http.js";
export type { HttpAppOptions } from "./http.js";

export {
	createWebhookRouter,
	WebhookRegistry,
	defaultVerifiers,
} from "./webhook.js";
export type {
	WebhookEvent,
	WebhookHandler,
	WebhookSubscription,
	WebhookVerifier,
	WebhookVerifiers,
	WebhookRouterOptions,
} from "./webhook.js";
export { runCli } from "./cli.js";
export { createRestRouter, listRESTRoutes } from "./rest.js";
export { createWorkflowRouter, type WorkflowRouterOptions } from "./workflow-http.js";
export { createRpcRouter, extractAuthFromHeaders } from "./rpc.js";
