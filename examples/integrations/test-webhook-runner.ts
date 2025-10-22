/**
 * Script to test webhook integration
 * 
 * This script:
 * 1. Starts a server with webhooks
 * 2. Executes a test workflow that pauses waiting for webhooks
 * 3. Simulates a webhook event
 * 4. Verifies the workflow resumes
 */

import { collectRegistry } from "@c4c/core";
import { createHttpServer, WebhookRegistry } from "@c4c/adapters";
import { EventRouter, executeWorkflow } from "@c4c/workflow";
import type { WebhookEvent } from "@c4c/adapters";
import { testWebhookWorkflow } from "./workflows/test-webhook.js";

async function main() {
	console.log("🧪 Starting Webhook Integration Test\n");
	
	// 1. Load registry
	console.log("📚 Loading procedures...");
	const registry = await collectRegistry("./procedures");
	console.log(`   ✓ Loaded ${registry.size} procedures\n`);
	
	// 2. Create webhook and event router
	console.log("🔧 Setting up webhook system...");
	const webhookRegistry = new WebhookRegistry();
	const eventRouter = new EventRouter();
	
	// Connect webhooks to event router
	webhookRegistry.registerHandler("googleDrive", async (event) => {
		console.log(`\n📨 Received webhook event:`, {
			id: event.id,
			provider: event.provider,
			eventType: event.eventType,
		});
		
		const results = await eventRouter.routeEvent(event);
		
		console.log(`\n🔄 Routing results:`);
		for (const result of results) {
			if (result.success) {
				console.log(`   ✓ Resumed execution ${result.executionId}`);
				console.log(`   Status: ${result.result?.status}`);
			} else {
				console.log(`   ✗ Failed to resume ${result.executionId}:`, result.error?.message);
			}
		}
	});
	
	console.log("   ✓ Webhook system ready\n");
	
	// 3. Start HTTP server
	console.log("🚀 Starting HTTP server...");
	const server = createHttpServer(registry, 3000, {
		enableWebhooks: true,
		enableWorkflow: true,
		webhookRegistry,
	});
	console.log("   ✓ Server running on http://localhost:3000\n");
	
	// 4. Register resume handler
	console.log("🔄 Registering workflow resume handler...");
	eventRouter.registerResumeHandler(testWebhookWorkflow.id, async (state, event) => {
		console.log(`\n🔄 Resuming workflow from node: ${state.currentNode}`);
		console.log(`   Event: ${event.eventType}`);
		console.log(`   Payload:`, event.payload);
		
		// Resume workflow with event data in variables
		const result = await executeWorkflow(
			testWebhookWorkflow,
			registry,
			state.variables
		);
		
		console.log(`\n✅ Workflow resumed and completed:`, {
			status: result.status,
			executionTime: `${result.executionTime}ms`,
			nodesExecuted: result.nodesExecuted,
		});
		
		return result;
	});
	console.log("   ✓ Resume handler registered\n");
	
	// 5. Execute test workflow
	console.log("▶️  Executing test workflow...");
	const result = await executeWorkflow(
		testWebhookWorkflow,
		registry,
		{
			webhookUrl: "http://localhost:3000/webhooks/googleDrive",
		}
	);
	
	console.log(`\n📊 Workflow execution result:`, {
		status: result.status,
		executionTime: `${result.executionTime}ms`,
		nodesExecuted: result.nodesExecuted,
	});
	
	// 6. If workflow paused, register with event router
	if (result.status === "paused" && result.resumeState) {
		console.log("\n⏸️  Workflow paused, registering with event router...");
		
		eventRouter.registerPausedExecution({
			workflowId: testWebhookWorkflow.id,
			executionId: result.executionId,
			pausedAt: result.resumeState.currentNode,
			resumeOn: {
				provider: "googleDrive",
				eventType: "change",
			},
			state: result.resumeState,
			pausedTime: new Date(),
			timeout: 300000,
		});
		
		console.log("   ✓ Registered paused execution");
		console.log(`   Execution ID: ${result.executionId}`);
		console.log(`   Paused at node: ${result.resumeState.currentNode}`);
		
		// 7. Simulate webhook event after 3 seconds
		console.log("\n⏱️  Simulating webhook event in 3 seconds...\n");
		
		setTimeout(async () => {
			console.log("🧪 Simulating webhook POST request...");
			
			const mockEvent: WebhookEvent = {
				id: `evt_test_${Date.now()}`,
				provider: "googleDrive",
				eventType: "change",
				subscriptionId: "sub_test_123",
				payload: {
					kind: "drive#change",
					changeType: "file",
					fileId: "test_file_123",
					file: {
						id: "test_file_123",
						name: "test-document.pdf",
						mimeType: "application/pdf",
						modifiedTime: new Date().toISOString(),
					},
				},
				headers: {
					"x-goog-channel-id": "channel_test_123",
					"x-goog-resource-state": "change",
				},
				timestamp: new Date(),
			};
			
			console.log("   Event details:", {
				id: mockEvent.id,
				provider: mockEvent.provider,
				eventType: mockEvent.eventType,
			});
			
			// Dispatch event through webhook registry
			await webhookRegistry.dispatch(mockEvent);
			
			// Wait a bit then check paused executions
			setTimeout(() => {
				const remaining = eventRouter.getPausedExecutions();
				console.log(`\n📊 Remaining paused executions: ${remaining.length}`);
				
				if (remaining.length === 0) {
					console.log("\n✅ SUCCESS! All workflows resumed and completed!\n");
				} else {
					console.log("\n⚠️  Some executions still paused:\n");
					for (const exec of remaining) {
						console.log(`   - ${exec.executionId} (paused at ${exec.pausedAt})`);
					}
				}
				
				console.log("\n🎉 Test completed! Press Ctrl+C to exit.\n");
			}, 1000);
			
		}, 3000);
		
	} else {
		console.log("\n⚠️  Workflow did not pause as expected!");
		console.log(`   Status: ${result.status}`);
		process.exit(1);
	}
}

// Run the test
main().catch((error) => {
	console.error("\n❌ Test failed:", error);
	process.exit(1);
});
