/**
 * Long Running Workflow
 *
 * Demonstrates durable workflows with sleep, parallel branches,
 * and real-time progress using the Workflow DevKit pattern.
 */

import { sleep } from "@c4c/workflow";

// Step functions with "use step" directive

async function log(message: string, level: string = "info") {
	"use step";
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
	return { logged: true, timestamp };
}

async function fetchUserData(userId: string) {
	"use step";
	console.log(`[data.fetch] Fetching data for user: ${userId}`);
	const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
	const tiers = ["basic", "premium", "enterprise"] as const;
	return {
		userId,
		isPremium: hash % 3 !== 0,
		tier: tiers[hash % tiers.length],
		fetchedAt: new Date().toISOString(),
	};
}

async function heavyComputation(iterations: number, label: string) {
	"use step";
	const startTime = Date.now();
	console.log(`[heavyComputation] ${label} with ${iterations} iterations...`);
	let result = 0;
	for (let i = 0; i < iterations; i++) {
		result += Math.sqrt(i) * Math.sin(i);
	}
	const duration = Date.now() - startTime;
	console.log(`[heavyComputation] Completed in ${duration}ms`);
	return { completed: true, iterations, result, duration };
}

async function sendNotification(message: string, channel: string = "default") {
	"use step";
	const timestamp = new Date().toISOString();
	console.log(`[sendNotification] [${channel}] ${message}`);
	return { sent: true, timestamp };
}

/**
 * Long Running Workflow (~1 minute execution time)
 * Demonstrates durable sleep, parallel steps, and progress tracking.
 */
export async function longRunningWorkflow() {
	"use workflow";

	await log("Starting long-running workflow...", "info");

	// Phase 1: Initialize - durable sleep survives restarts
	console.log("Phase 1: Initializing (10 seconds)...");
	await sleep("10s");

	// Fetch data step
	const userData = await fetchUserData("demo-user-123");
	console.log("User data fetched:", userData.tier);

	// Phase 2: Process data
	console.log("Phase 2: Processing data (15 seconds)...");
	await sleep("15s");

	// Parallel tasks - just Promise.all
	const [computeResult, _ioResult] = await Promise.all([
		heavyComputation(500000, "Computing analytics..."),
		(async () => {
			// Inline step for I/O simulation
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
	};
}
