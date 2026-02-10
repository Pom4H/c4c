/**
 * Cross-App Workflow: Create Task and Send Notification
 *
 * Demonstrates cross-app integration using Workflow DevKit:
 * 1. Creates a task in App A (local step)
 * 2. Calls App B to send a notification (cross-app step)
 *
 * Before (old DSL): WorkflowDefinition with nodes array
 * After: Plain async function with steps
 */

import { step, FatalError } from "@c4c/workflow";

// Local step: create task in App A
const createTask = step("tasks.create", async (input: {
	title: string;
	description: string;
	priority: string;
	status: string;
}) => {
	// This would normally call the local tasks procedure
	console.log(`[tasks.create] Creating task: ${input.title}`);
	return {
		id: `task_${Date.now()}`,
		...input,
		createdAt: new Date().toISOString(),
	};
});

// Cross-app step: call notification service in App B
const sendNotification = step("notification-service.notifications.send", async (input: {
	message: string;
	channel: string;
	priority: string;
}) => {
	// This would call App B's notification-service via HTTP
	console.log(`[notification-service] Sending: ${input.message}`);
	return {
		id: `notif_${Date.now()}`,
		message: input.message,
		channel: input.channel,
		sentAt: new Date().toISOString(),
	};
});

/**
 * Creates a task and sends a notification via cross-app call
 */
export async function createTaskWithNotification() {
	"use workflow";

	console.log("Cross-app workflow: Create Task with Notification");

	// Step 1: Create task locally
	const task = await createTask({
		title: "Cross-App Integration Test",
		description: "This task was created by a workflow that calls another service",
		priority: "high",
		status: "todo",
	});
	console.log("Task created:", task.id);

	// Step 2: Send notification via App B
	const notification = await sendNotification({
		message: "New task created via cross-app workflow!",
		channel: "push",
		priority: "high",
	});
	console.log("Notification sent:", notification.id);

	return { task, notification };
}
