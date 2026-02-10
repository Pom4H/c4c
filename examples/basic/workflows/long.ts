/**
 * Long Running Workflow
 *
 * Demonstrates a workflow with delays, parallel branches, and
 * real-time progress - all using plain async/await.
 *
 * Before (old DSL): 10+ node objects with config, next, type fields
 * After: Just an async function with steps
 */

import { step, sleep } from "@c4c/workflow";

// Step functions
const log = step("custom.log", async (message: string, level: string = "info") => {
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
	return { logged: true, timestamp };
});

const fetchUserData = step("data.fetch", async (userId: string) => {
	console.log(`[data.fetch] Fetching data for user: ${userId}`);
	await new Promise((resolve) => setTimeout(resolve, 500));
	const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
	const tiers = ["basic", "premium", "enterprise"] as const;
	return {
		userId,
		isPremium: hash % 3 !== 0,
		tier: tiers[hash % tiers.length],
		fetchedAt: new Date().toISOString(),
	};
});

const heavyComputation = step("custom.heavyComputation", async (iterations: number, label: string) => {
	const startTime = Date.now();
	console.log(`[heavyComputation] ${label} with ${iterations} iterations...`);
	let result = 0;
	for (let i = 0; i < iterations; i++) {
		result += Math.sqrt(i) * Math.sin(i);
	}
	const duration = Date.now() - startTime;
	console.log(`[heavyComputation] Completed in ${duration}ms`);
	return { completed: true, iterations, result, duration };
});

const sendNotification = step("custom.sendNotification", async (message: string, channel: string = "default") => {
	const timestamp = new Date().toISOString();
	console.log(`[sendNotification] [${channel}] ${message}`);
	return { sent: true, timestamp };
});

/**
 * Long Running Workflow (~1 minute execution time)
 * Perfect for watching real-time updates in UI
 */
export async function longRunningWorkflow() {
	"use workflow";

	await log("Starting long-running workflow...", "info");

	// Phase 1: Initialize
	console.log("Phase 1: Initializing (10 seconds)...");
	await sleep("10s");

	// Fetch data
	const userData = await fetchUserData("demo-user-123");
	console.log("User data fetched:", userData.tier);

	// Phase 2: Process data
	console.log("Phase 2: Processing data (15 seconds)...");
	await sleep("15s");

	// Parallel tasks - replaces the old "parallel" node type
	const [computeResult, ioResult] = await Promise.all([
		heavyComputation(500000, "Computing analytics..."),
		(async () => {
			console.log("Saving to database...");
			await sleep("12s");
			return { saved: true };
		})(),
	]);

	// Phase 3: Finalize
	console.log("Phase 3: Finalizing (10 seconds)...");
	await sleep("10s");

	await sendNotification("Long-running workflow completed successfully!", "slack");

	await log("Workflow completed! Total time: ~1 minute", "info");

	return {
		userData,
		computeResult,
		ioResult,
	};
}
