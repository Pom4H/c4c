/**
 * Workflow: Check Overdue Tasks
 *
 * Uses "use step" / "use workflow" directives from the Workflow DevKit.
 */

async function getTasksFromTaskManager(status: string) {
	"use step";
	console.log(`[task-manager] Listing tasks with status: ${status}`);
	return {
		tasks: [
			{ id: "task_1", title: "Overdue task 1", dueDate: "2025-01-01", assignee: "alice" },
			{ id: "task_2", title: "Overdue task 2", dueDate: "2025-01-15", assignee: "bob" },
		],
		total: 2,
	};
}

async function sendOverdueNotification(input: { message: string; channel: string; priority: string }) {
	"use step";
	console.log(`[notifications.send] Sending: ${input.message}`);
	return { id: `notif_${Date.now()}`, message: input.message };
}

export async function checkOverdueTasks() {
	"use workflow";

	const { tasks, total } = await getTasksFromTaskManager("in_progress");
	console.log(`Found ${total} in-progress tasks`);

	const now = new Date();
	const overdueTasks = tasks.filter((task) => {
		if (!task.dueDate) return false;
		return new Date(task.dueDate) < now;
	});

	if (overdueTasks.length === 0) {
		return { overdueTasks: [], notificationSent: false };
	}

	const notification = await sendOverdueNotification({
		message: `You have ${overdueTasks.length} overdue task(s)!`,
		channel: "email",
		priority: "high",
	});

	return { overdueTasks, notificationSent: true, notification };
}
