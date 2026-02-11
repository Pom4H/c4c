/**
 * Basic workflow test cases for Workflow DevKit integration
 */

import { FatalError, sleep } from "workflow";

// ---- Steps ----

async function add(a: number, b: number): Promise<number> {
	"use step";
	return a + b;
}

async function multiply(a: number, b: number): Promise<number> {
	"use step";
	return a * b;
}

async function failOnce(): Promise<string> {
	"use step";
	// Simulate a retryable failure - uses a random check
	// In real usage the runtime caches step results so retries work deterministically
	if (Math.random() < 0.5) {
		throw new Error("Transient failure");
	}
	return "recovered";
}

async function fatalStep(): Promise<never> {
	"use step";
	throw new FatalError("This is a permanent failure");
}

async function greet(name: string): Promise<string> {
	"use step";
	return `Hello, ${name}!`;
}

async function delayedMessage(ms: number, msg: string): Promise<string> {
	"use step";
	await new Promise((resolve) => setTimeout(resolve, ms));
	return `${msg} (delayed ${ms}ms)`;
}

// ---- Workflows ----

/**
 * Simple sequential workflow
 */
export async function simpleWorkflow(x: number) {
	"use workflow";
	const a = await add(x, 10);
	const b = await multiply(a, 2);
	return b;
}

/**
 * Workflow with parallel steps (Promise.all)
 */
export async function parallelWorkflow() {
	"use workflow";
	const [sum, product, greeting] = await Promise.all([
		add(5, 3),
		multiply(4, 7),
		greet("World"),
	]);
	return { sum, product, greeting };
}

/**
 * Workflow with Promise.race
 */
export async function raceWorkflow() {
	"use workflow";
	const winner = await Promise.race([
		delayedMessage(100, "fast"),
		delayedMessage(2000, "slow"),
	]);
	return { winner };
}

/**
 * Workflow with error handling (FatalError)
 */
export async function errorWorkflow() {
	"use workflow";
	const a = await add(1, 2);
	try {
		await fatalStep();
	} catch (error) {
		if (error instanceof Error) {
			return { result: a, caught: error.message };
		}
	}
	return { result: a, caught: null };
}

/**
 * Workflow with conditional logic
 */
export async function conditionalWorkflow(x: number) {
	"use workflow";
	const doubled = await multiply(x, 2);
	let result: number;
	if (doubled > 20) {
		result = await add(doubled, 100);
	} else {
		result = await add(doubled, 1);
	}
	return { input: x, doubled, result };
}

/**
 * Workflow with sleep
 */
export async function sleepWorkflow() {
	"use workflow";
	const before = await greet("before sleep");
	await sleep("1s");
	const after = await greet("after sleep");
	return { before, after };
}

/**
 * Workflow with loop
 */
export async function loopWorkflow(count: number) {
	"use workflow";
	let total = 0;
	for (let i = 0; i < count; i++) {
		total = await add(total, i + 1);
	}
	return { total, count };
}
