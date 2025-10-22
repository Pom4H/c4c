/**
 * Complete Example: Google Drive Webhook Integration
 * 
 * This example shows how to:
 * 1. Set up webhook endpoints
 * 2. Subscribe to Google Drive changes
 * 3. Receive and process webhook events
 * 4. Clean up subscriptions
 */

import { collectRegistry, findTriggers } from "@c4c/core";
import { createHttpServer, WebhookRegistry } from "@c4c/adapters";
import { EventRouter, executeWorkflow } from "@c4c/workflow";
import type { WebhookEvent } from "@c4c/adapters";

/**
 * Step 1: Initialize the system
 */
async function setupWebhookSystem() {
	// Load procedures
	const registry = await collectRegistry("./procedures");
	
	// Create webhook and event router instances
	const webhookRegistry = new WebhookRegistry();
	const eventRouter = new EventRouter();
	
	// Connect webhook events to event router
	webhookRegistry.registerHandler("googleDrive", async (event) => {
		console.log("📨 Received Google Drive event:", event.eventType);
		await eventRouter.routeEvent(event);
	});
	
	// Start HTTP server with webhooks enabled
	const server = createHttpServer(registry, 3000, {
		enableWebhooks: true,
		webhookRegistry,
	});
	
	console.log("✅ Webhook system ready!");
	console.log("📡 Webhook URL: http://localhost:3000/webhooks/googleDrive");
	
	return { registry, webhookRegistry, eventRouter, server };
}

/**
 * Step 2: Subscribe to Google Drive changes
 */
async function subscribeToDriveChanges(registry: any) {
	const trigger = registry.get("googleDrive.drive.changes.watch");
	
	if (!trigger) {
		throw new Error("Google Drive watch trigger not found");
	}
	
	// 1. Get start page token
	const getTokenProcedure = registry.get("googleDrive.drive.changes.get.start.page.token");
	const tokenResult = await getTokenProcedure.handler({}, {
		requestId: "req_1",
		timestamp: new Date(),
		metadata: {},
	});
	
	// 2. Subscribe to changes
	const subscription = await trigger.handler({
		pageToken: tokenResult.startPageToken,
		requestBody: {
			id: `channel_${Date.now()}`,
			type: "web_hook",
			address: "http://localhost:3000/webhooks/googleDrive",
			// Token for webhook verification (optional)
			token: "secret_verification_token",
		},
	}, {
		requestId: "req_2",
		timestamp: new Date(),
		metadata: {
			// OAuth token
			googleDriveToken: process.env.GOOGLE_DRIVE_TOKEN,
		},
	});
	
	console.log("✅ Subscribed to Google Drive changes:");
	console.log("   Channel ID:", subscription.id);
	console.log("   Resource ID:", subscription.resourceId);
	console.log("   Expiration:", subscription.expiration);
	
	return subscription;
}

/**
 * Step 3: Create a workflow that processes drive changes
 */
const driveChangeWorkflow = {
	id: "process-drive-changes",
	name: "Process Google Drive Changes",
	version: "1.0.0",
	startNode: "get-token",
	
	nodes: [
		// Step 1: Get page token
		{
			id: "get-token",
			type: "procedure" as const,
			procedureName: "googleDrive.drive.changes.get.start.page.token",
			config: {},
			next: "subscribe",
		},
		
		// Step 2: Subscribe to changes
		{
			id: "subscribe",
			type: "procedure" as const,
			procedureName: "googleDrive.drive.changes.watch",
			config: {
				pageToken: "{{ outputs['get-token'].startPageToken }}",
				requestBody: {
					id: "{{ workflowId }}_{{ executionId }}",
					type: "web_hook",
					address: "{{ webhookUrl }}",
				},
			},
			next: "wait-for-event",
			onError: "cleanup",
		},
		
		// Step 3: Pause and wait for webhook event
		{
			id: "wait-for-event",
			type: "procedure" as const,
			procedureName: "workflow.pause",
			config: {
				resumeOn: {
					provider: "googleDrive",
					eventType: "change",
				},
				timeout: 3600000, // 1 hour
			},
			next: "list-changes",
		},
		
		// Step 4: List actual changes
		{
			id: "list-changes",
			type: "procedure" as const,
			procedureName: "googleDrive.drive.changes.list",
			config: {
				pageToken: "{{ webhook.payload.pageToken || outputs['get-token'].startPageToken }}",
			},
			next: "process-each-change",
		},
		
		// Step 5: Process each change
		{
			id: "process-each-change",
			type: "procedure" as const,
			procedureName: "custom.processChange",
			config: {
				changes: "{{ outputs['list-changes'].changes }}",
			},
			next: "wait-for-event", // Loop back
		},
		
		// Cleanup on error
		{
			id: "cleanup",
			type: "procedure" as const,
			procedureName: "googleDrive.drive.channels.stop",
			config: {
				requestBody: {
					id: "{{ outputs.subscribe.id }}",
					resourceId: "{{ outputs.subscribe.resourceId }}",
				},
			},
		},
	],
};

/**
 * Step 4: Run the workflow with event routing
 */
async function runWorkflowWithWebhooks(
	registry: any,
	eventRouter: any,
	webhookRegistry: any
) {
	const workflowId = driveChangeWorkflow.id;
	const executionId = `exec_${Date.now()}`;
	
	// Register resume handler
	eventRouter.registerResumeHandler(workflowId, async (state, event) => {
		console.log(`🔄 Resuming workflow from ${state.currentNode}`);
		console.log(`📨 Event type: ${event.eventType}`);
		
		// Resume workflow execution
		return await executeWorkflow(
			driveChangeWorkflow,
			registry,
			state.variables
		);
	});
	
	// Start workflow execution
	console.log("🚀 Starting workflow...");
	
	try {
		const result = await executeWorkflow(
			driveChangeWorkflow,
			registry,
			{
				webhookUrl: "http://localhost:3000/webhooks/googleDrive",
			}
		);
		
		console.log("✅ Workflow completed:", result.status);
		
		// If workflow paused, register with event router
		if (result.status === "paused" && result.resumeState) {
			eventRouter.registerPausedExecution({
				workflowId,
				executionId,
				pausedAt: result.resumeState.currentNode,
				resumeOn: {
					provider: "googleDrive",
					eventType: "change",
				},
				state: result.resumeState,
				pausedTime: new Date(),
				timeout: 3600000, // 1 hour
			});
			
			console.log("⏸️  Workflow paused, waiting for webhook events...");
		}
	} catch (error) {
		console.error("❌ Workflow error:", error);
	}
}

/**
 * Step 5: Simulate a webhook event (for testing)
 */
function simulateWebhookEvent(webhookRegistry: any) {
	const mockEvent: WebhookEvent = {
		id: "evt_test_123",
		provider: "googleDrive",
		eventType: "change",
		payload: {
			kind: "drive#change",
			changeType: "file",
			fileId: "1234567890",
			file: {
				id: "1234567890",
				name: "test-file.txt",
				mimeType: "text/plain",
			},
		},
		headers: {
			"x-goog-channel-id": "channel_123",
			"x-goog-resource-state": "change",
		},
		timestamp: new Date(),
	};
	
	console.log("\n🧪 Simulating webhook event...");
	webhookRegistry.dispatch(mockEvent);
}

/**
 * Main function
 */
async function main() {
	console.log("🔧 Setting up Google Drive Webhook Integration\n");
	
	// Setup
	const { registry, webhookRegistry, eventRouter, server } = await setupWebhookSystem();
	
	// Find triggers
	const triggers = findTriggers(registry);
	console.log(`\n📡 Found ${triggers.size} triggers`);
	
	// Run workflow
	await runWorkflowWithWebhooks(registry, eventRouter, webhookRegistry);
	
	// For testing: simulate an event after 5 seconds
	setTimeout(() => {
		simulateWebhookEvent(webhookRegistry);
	}, 5000);
	
	console.log("\n✨ System ready! Waiting for webhook events...");
	console.log("Press Ctrl+C to stop\n");
}

/**
 * Usage instructions
 */
console.log(`
╔════════════════════════════════════════════════════════════════╗
║         Google Drive Webhook Integration Example              ║
╚════════════════════════════════════════════════════════════════╝

This example demonstrates:
✓ Setting up webhook endpoints
✓ Subscribing to Google Drive file changes
✓ Receiving and routing webhook events
✓ Pausing/resuming workflows based on events

To run:
  1. Set GOOGLE_DRIVE_TOKEN environment variable
  2. Run: node complete-webhook-example.js
  3. Make changes to files in your Google Drive
  4. Watch events being processed in real-time!

Architecture:
  Google Drive → Webhook → Event Router → Workflow

Flow:
  1. Workflow subscribes to Google Drive changes
  2. Workflow pauses, waiting for events
  3. Google Drive sends webhook when file changes
  4. Event Router matches event to paused workflow
  5. Workflow resumes and processes the change
  6. Workflow pauses again (loop)

`);

// Run only if this is the main module
if (require.main === module) {
	main().catch(console.error);
}

export { setupWebhookSystem, subscribeToDriveChanges, driveChangeWorkflow };
