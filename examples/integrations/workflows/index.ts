/**
 * Workflow examples for C4C Framework
 * Using the simplified trigger approach
 */

import {
	googleDriveMonitor,
	slackBot,
	complexTriggerWorkflow,
} from "./trigger-example.js";

export {
	googleDriveMonitor,
	slackBot,
	complexTriggerWorkflow,
};

export const workflows = [
	googleDriveMonitor,
	slackBot,
	complexTriggerWorkflow,
] as const;
