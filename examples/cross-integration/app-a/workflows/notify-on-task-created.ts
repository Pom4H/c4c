/**
 * Workflow: Notify on Task Created
 *
 * When a task is created, fetch its details and send a notification
 * via the cross-app notification service.
 *
 * Before (old DSL): workflow().step().step().commit()
 * After: Plain async function with steps
 */

import { step } from "@c4c/workflow";

// Step: Get task details from local task service
const getTaskDetails = step("tasks.get", async (taskId: string) => {
	console.log(`[tasks.get] Fetching task: ${taskId}`);
	// Mock: would call actual task service
	return {
		id: taskId,
		title: "Example Task",
		priority: "high",
	};
});

// Step: Send notification via App B
const sendNotification = step(
	"notification-service.notifications.send",
	async (input: { message: string; channel: string; priority: string }) => {
		console.log(`[notification-service] Sending: ${input.message}`);
		return {
			id: `notif_${Date.now()}`,
			message: input.message,
		};
	},
);

/**
 * Notify on task created workflow
 */
export async function notifyOnTaskCreated(taskId: string) {
	"use workflow";

	console.log("Notify on task created workflow started");

	// Step 1: Get task details
	const task = await getTaskDetails(taskId);

	// Step 2: Send notification via App B (cross-app call)
	const notification = await sendNotification({
		message: `New task created: ${task.title}`,
		channel: "push",
		priority: task.priority === "high" ? "urgent" : "normal",
	});

	console.log("Notification sent:", notification.id);
	return { task, notification };
}
