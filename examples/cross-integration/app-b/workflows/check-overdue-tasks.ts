/**
 * Workflow: Check Overdue Tasks
 *
 * Checks for overdue tasks in App A (task-manager) and sends notifications.
 * Demonstrates cross-app data fetching.
 *
 * Before (old DSL): workflow().step().step().commit()
 * After: Plain async function with steps
 */

import { step } from "@c4c/workflow";

// Step: Get tasks from App A (cross-app call)
const getTasksFromTaskManager = step("task-manager.tasks.list", async (status: string) => {
	console.log(`[task-manager] Listing tasks with status: ${status}`);
	// Mock: would call App A's task-manager service via HTTP
	return {
		tasks: [
			{ id: "task_1", title: "Overdue task 1", dueDate: "2025-01-01", assignee: "alice" },
			{ id: "task_2", title: "Overdue task 2", dueDate: "2025-01-15", assignee: "bob" },
		],
		total: 2,
	};
});

// Step: Send notification locally
const sendOverdueNotification = step("notifications.send", async (input: {
	message: string;
	channel: string;
	priority: string;
}) => {
	console.log(`[notifications.send] Sending: ${input.message}`);
	return {
		id: `notif_${Date.now()}`,
		message: input.message,
	};
});

/**
 * Check overdue tasks and notify
 */
export async function checkOverdueTasks() {
	"use workflow";

	console.log("Check overdue tasks workflow started");

	// Step 1: Get in-progress tasks from App A
	const { tasks, total } = await getTasksFromTaskManager("in_progress");
	console.log(`Found ${total} in-progress tasks`);

	// Filter overdue tasks
	const now = new Date();
	const overdueTasks = tasks.filter((task) => {
		if (!task.dueDate) return false;
		return new Date(task.dueDate) < now;
	});

	if (overdueTasks.length === 0) {
		console.log("No overdue tasks found");
		return { overdueTasks: [], notificationSent: false };
	}

	// Step 2: Send notification about overdue tasks
	const notification = await sendOverdueNotification({
		message: `You have ${overdueTasks.length} overdue task(s)!`,
		channel: "email",
		priority: "high",
	});

	console.log("Overdue notification sent:", notification.id);
	return { overdueTasks, notificationSent: true };
}
