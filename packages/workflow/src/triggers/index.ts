/**
 * Triggers Module
 * 
 * Exports trigger-based workflow functionality
 */

export {
	TriggerWorkflowManager,
	createTriggerWorkflowManager,
} from "./trigger-manager.js";
export type {
	TriggerSubscription,
	DeployTriggerWorkflowOptions,
	WebhookEvent,
} from "./trigger-manager.js";

export { createSubworkflowProcedure } from "./subworkflow.js";