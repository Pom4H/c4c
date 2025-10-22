/**
 * Workflow examples for C4C Framework
 * Using the simplified trigger approach
 */

import {
	googleDriveMonitor,
	slackBot,
	complexTriggerWorkflow,
} from "./trigger-example.js";

import {
	simpleMathWorkflow,
	dataProcessingWorkflow,
	parallelWorkflow,
	loggingWorkflow,
	longRunningWorkflow,
	veryLongWorkflow,
} from "./demo-workflow.js";

export {
	googleDriveMonitor,
	slackBot,
	complexTriggerWorkflow,
	simpleMathWorkflow,
	dataProcessingWorkflow,
	parallelWorkflow,
	loggingWorkflow,
	longRunningWorkflow,
	veryLongWorkflow,
};

export const workflows = [
	simpleMathWorkflow,
	dataProcessingWorkflow,
	parallelWorkflow,
	loggingWorkflow,
	longRunningWorkflow,
	veryLongWorkflow,
	googleDriveMonitor,
	slackBot,
	complexTriggerWorkflow,
] as const;
