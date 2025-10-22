/**
 * Test workflow for webhook integration
 * Simple workflow that logs incoming webhook events
 */

export const testWebhookWorkflow = {
	id: "test-webhook",
	name: "Test Webhook Integration",
	description: "Simple workflow to test webhook event routing",
	version: "1.0.0",
	startNode: "log-start",
	
	nodes: [
		{
			id: "log-start",
			type: "procedure" as const,
			procedureName: "math.add",
			config: {
				a: 1,
				b: 1,
			},
			next: "wait-for-webhook",
		},
		{
			id: "wait-for-webhook",
			type: "procedure" as const,
			procedureName: "workflow.pause",
			config: {
				reason: "waiting-for-webhook",
				resumeOn: {
					provider: "googleDrive",
					eventType: "change",
				},
				timeout: 300000, // 5 minutes
			},
			next: "process-webhook",
		},
		{
			id: "process-webhook",
			type: "procedure" as const,
			procedureName: "math.multiply",
			config: {
				a: 10,
				b: 5,
			},
			next: undefined,
		},
	],
};

export default testWebhookWorkflow;
