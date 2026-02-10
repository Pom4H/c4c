/**
 * Simple Math Workflow
 *
 * Demonstrates the "use workflow" / step() pattern
 * replacing the old DAG-based WorkflowDefinition approach.
 *
 * Before (old DSL):
 *   export const simpleMathWorkflow: WorkflowDefinition = {
 *     nodes: [{ id: "add", type: "procedure", procedureName: "math.add", ... }]
 *   };
 *
 * After (Workflow DevKit):
 *   Just write plain async functions!
 */

import { step, FatalError } from "@c4c/workflow";

// Step functions - these get automatic retry semantics
const add = step("math.add", async (a: number, b: number): Promise<number> => {
	console.log(`[math.add] ${a} + ${b}`);
	return a + b;
});

const multiply = step("math.multiply", async (a: number, b: number): Promise<number> => {
	console.log(`[math.multiply] ${a} * ${b}`);
	return a * b;
});

const subtract = step("math.subtract", async (a: number, b: number): Promise<number> => {
	console.log(`[math.subtract] ${a} - ${b}`);
	return a - b;
});

/**
 * Simple sequential math workflow
 *
 * Just a normal async function - no DAG, no nodes, no config objects.
 * Control flow uses standard JavaScript.
 */
export async function simpleMathWorkflow() {
	"use workflow";

	console.log("Simple Math Workflow started");

	const sum = await add(10, 5);
	console.log("Step 1 completed - sum:", sum);

	const product = await multiply(3, 2);
	console.log("Step 2 completed - product:", product);

	const difference = await subtract(20, 8);
	console.log("Step 3 completed - difference:", difference);

	console.log("Simple Math Workflow completed");
	return { sum, product, difference };
}

/**
 * Math workflow with parallel steps
 *
 * Promise.all replaces the old "parallel" node type.
 */
export async function parallelMathWorkflow() {
	"use workflow";

	console.log("Parallel Math Workflow started");

	// Run multiple operations in parallel - just use Promise.all!
	const [sum, product, difference] = await Promise.all([
		add(10, 5),
		multiply(3, 7),
		subtract(100, 42),
	]);

	console.log("All parallel steps completed:", { sum, product, difference });

	// Chain more operations using previous results
	const finalResult = await add(sum, product);
	console.log("Final result:", finalResult);

	return { sum, product, difference, finalResult };
}

/**
 * Math workflow with conditional logic
 *
 * if/else replaces the old "condition" node type.
 */
export async function conditionalMathWorkflow(x: number) {
	"use workflow";

	console.log(`Conditional Math Workflow started with x=${x}`);

	const doubled = await multiply(x, 2);

	// Conditional logic is just JavaScript - no config objects needed!
	let result: number;
	if (doubled > 20) {
		result = await subtract(doubled, 10);
		console.log("Took the 'greater than 20' branch");
	} else {
		result = await add(doubled, 10);
		console.log("Took the 'less than or equal to 20' branch");
	}

	return { input: x, doubled, result };
}
