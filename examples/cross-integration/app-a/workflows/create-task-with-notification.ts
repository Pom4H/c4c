/**
 * Cross-App Workflow: Create Task and Send Notification
 *
 * Uses "use step" directive for each operation.
 * Cross-app calls are just step functions that make HTTP requests.
 */

async function createTask(input: {
	title: string;
	description: string;
	priority: string;
	status: string;
}) {
	"use step";
	console.log(`[tasks.create] Creating task: ${input.title}`);
	return {
		id: `task_${Date.now()}`,
		...input,
		createdAt: new Date().toISOString(),
	};
}

async function sendNotificationToAppB(input: {
	message: string;
	channel: string;
	priority: string;
}) {
	"use step";
	// In production, this would make an HTTP call to App B
	console.log(`[notification-service] Sending: ${input.message}`);
	return {
		id: `notif_${Date.now()}`,
		message: input.message,
		channel: input.channel,
		sentAt: new Date().toISOString(),
	};
}

/**
 * Creates a task and sends a notification via cross-app call
 */
export async function createTaskWithNotification() {
	"use workflow";

	console.log("Cross-app workflow: Create Task with Notification");

	const task = await createTask({
		title: "Cross-App Integration Test",
		description: "This task was created by a workflow that calls another service",
		priority: "high",
		status: "todo",
	});
	console.log("Task created:", task.id);

	const notification = await sendNotificationToAppB({
		message: "New task created via cross-app workflow!",
		channel: "push",
		priority: "high",
	});
	console.log("Notification sent:", notification.id);

	return { task, notification };
}
