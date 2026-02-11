/**
 * Long-running workflow with durable sleep
 */

import { sleep } from "workflow";

async function log(message: string) {
	"use step";
	console.log(`[${new Date().toISOString()}] ${message}`);
}

async function fetchData(userId: string) {
	"use step";
	return { userId, tier: "premium", fetchedAt: new Date().toISOString() };
}

async function sendNotification(message: string) {
	"use step";
	console.log(`[notification] ${message}`);
	return { sent: true };
}

export async function longRunningWorkflow() {
	"use workflow";

	await log("Starting...");
	await sleep("10s");

	const data = await fetchData("user-123");
	await sleep("5s");

	await sendNotification(`Done processing ${data.userId}`);
	return data;
}
