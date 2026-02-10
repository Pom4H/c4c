/**
 * Workflow: Notify on Task Created
 *
 * Uses "use step" / "use workflow" directives from the Workflow DevKit.
 */

async function getTaskDetails(taskId: string) {
	"use step";
	console.log(`[tasks.get] Fetching task: ${taskId}`);
	return { id: taskId, title: "Example Task", priority: "high" };
}

async function sendNotification(input: { message: string; channel: string; priority: string }) {
	"use step";
	console.log(`[notification-service] Sending: ${input.message}`);
	return { id: `notif_${Date.now()}`, message: input.message };
}

export async function notifyOnTaskCreated(taskId: string) {
	"use workflow";

	const task = await getTaskDetails(taskId);

	const notification = await sendNotification({
		message: `New task created: ${task.title}`,
		channel: "push",
		priority: task.priority === "high" ? "urgent" : "normal",
	});

	return { task, notification };
}
