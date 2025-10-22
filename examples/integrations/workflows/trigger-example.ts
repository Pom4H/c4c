/**
 * Example: Using triggers in workflows
 * 
 * Demonstrates how to work with trigger-based procedures like
 * Google Drive's file watch functionality
 */

import {
	isTrigger,
	findTriggers,
	getTriggerMetadata,
	describeTrigger,
	groupTriggersByProvider,
	type Registry,
} from "@c4c/core";

/**
 * Example: Find all triggers in a registry
 */
export function discoverTriggers(registry: Registry) {
	const triggers = findTriggers(registry);
	
	console.log(`\n=== Found ${triggers.size} triggers ===\n`);
	
	for (const [name, procedure] of triggers) {
		const metadata = getTriggerMetadata(procedure);
		console.log(`📡 ${name}`);
		console.log(`   Type: ${metadata?.type}`);
		console.log(`   Description: ${procedure.contract.description}`);
		
		if (metadata?.stopProcedure) {
			console.log(`   Stop procedure: ${metadata.stopProcedure}`);
		}
		
		if (metadata?.requiresChannelManagement) {
			console.log(`   ⚠️  Requires channel management`);
		}
		
		console.log();
	}
}

/**
 * Example: Group triggers by provider
 */
export function groupTriggers(registry: Registry) {
	const grouped = groupTriggersByProvider(registry);
	
	console.log(`\n=== Triggers by Provider ===\n`);
	
	for (const [provider, triggers] of grouped) {
		console.log(`📦 ${provider}:`);
		for (const [name, procedure] of triggers) {
			console.log(`   - ${name}: ${describeTrigger(procedure)}`);
		}
		console.log();
	}
}

/**
 * Example workflow using a trigger
 * 
 * This workflow:
 * 1. Subscribes to Google Drive file changes
 * 2. Processes each change event
 * 3. Stops watching when done
 */
export const watchGoogleDriveChanges = {
	id: "watch-drive-changes",
	name: "Watch Google Drive Changes",
	description: "Monitor a Google Drive for file changes",
	version: "1.0.0",
	
	startNode: "get-start-token",
	
	nodes: [
		{
			id: "get-start-token",
			type: "procedure" as const,
			procedureName: "googleDrive.drive.changes.get.start.page.token",
			config: {},
			next: "subscribe-to-changes",
		},
		{
			id: "subscribe-to-changes",
			type: "procedure" as const,
			procedureName: "googleDrive.drive.changes.watch",
			config: {
				// pageToken from previous step
				pageToken: "{{ outputs['get-start-token'].startPageToken }}",
				// Channel configuration
				requestBody: {
					id: "{{ workflowId }}-{{ executionId }}",
					type: "web_hook",
					address: "{{ webhookUrl }}",
				},
			},
			next: "wait-for-events",
			// Store channel info for cleanup
			onError: "cleanup-subscription",
		},
		{
			id: "wait-for-events",
			type: "procedure" as const,
			procedureName: "workflow.pause",
			config: {
				reason: "waiting-for-webhook-events",
				resumeOn: "webhook-received",
			},
			next: "process-change",
		},
		{
			id: "process-change",
			type: "procedure" as const,
			procedureName: "custom.processFileChange",
			config: {
				changeData: "{{ webhook.payload }}",
			},
			next: "wait-for-events", // Loop back to wait for more events
		},
		{
			id: "cleanup-subscription",
			type: "procedure" as const,
			// Note: This would work if driveChannelsStop was generated
			// procedureName: "googleDrive.drive.channels.stop",
			procedureName: "custom.cleanupChannel",
			config: {
				channelId: "{{ outputs['subscribe-to-changes'].id }}",
				resourceId: "{{ outputs['subscribe-to-changes'].resourceId }}",
			},
		},
	],
};

/**
 * Example: Create a generic trigger subscription workflow
 */
export function createTriggerWorkflow(
	triggerId: string,
	processorId: string,
	options: {
		webhookUrl: string;
		filters?: Record<string, unknown>;
	}
) {
	return {
		id: `trigger-${triggerId}`,
		name: `Trigger: ${triggerId}`,
		version: "1.0.0",
		startNode: "subscribe",
		
		nodes: [
			{
				id: "subscribe",
				type: "procedure" as const,
				procedureName: triggerId,
				config: {
					webhookUrl: options.webhookUrl,
					...options.filters,
				},
				next: "wait",
				onError: "cleanup",
			},
			{
				id: "wait",
				type: "procedure" as const,
				procedureName: "workflow.pause",
				config: {
					resumeOn: "webhook-event",
				},
				next: "process",
			},
			{
				id: "process",
				type: "procedure" as const,
				procedureName: processorId,
				config: {
					eventData: "{{ webhook.payload }}",
				},
				next: "wait", // Loop
			},
			{
				id: "cleanup",
				type: "procedure" as const,
				procedureName: "custom.cleanup",
				config: {
					subscriptionId: "{{ outputs.subscribe.id }}",
				},
			},
		],
	};
}

/**
 * Example: Utility to check if a procedure can be used as a trigger
 */
export function validateTriggerProcedure(registry: Registry, procedureName: string): {
	valid: boolean;
	issues: string[];
	recommendations: string[];
} {
	const procedure = registry.get(procedureName);
	const issues: string[] = [];
	const recommendations: string[] = [];
	
	if (!procedure) {
		return {
			valid: false,
			issues: [`Procedure ${procedureName} not found in registry`],
			recommendations: [],
		};
	}
	
	if (!isTrigger(procedure)) {
		return {
			valid: false,
			issues: [`Procedure ${procedureName} is not marked as a trigger`],
			recommendations: [
				"Only procedures with type: 'trigger' can be used as workflow triggers",
				"Use findTriggers(registry) to discover available triggers",
			],
		};
	}
	
	const metadata = getTriggerMetadata(procedure);
	
	if (metadata?.requiresChannelManagement && !metadata?.stopProcedure) {
		issues.push("Trigger requires channel management but no stop procedure is configured");
		recommendations.push(
			"Add cleanup logic to your workflow to prevent resource leaks"
		);
	}
	
	if (metadata?.type === "poll" && !metadata?.pollingInterval) {
		issues.push("Poll-type trigger missing pollingInterval configuration");
		recommendations.push("Configure pollingInterval in trigger metadata");
	}
	
	return {
		valid: issues.length === 0,
		issues,
		recommendations,
	};
}
