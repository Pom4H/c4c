/**
 * Math Workflow - the simplest possible example
 */

import { FatalError } from "workflow";

async function add(a: number, b: number): Promise<number> {
	"use step";
	return a + b;
}

async function multiply(a: number, b: number): Promise<number> {
	"use step";
	return a * b;
}

/** Sequential: add then multiply */
export async function simpleMath(x: number) {
	"use workflow";
	const sum = await add(x, 10);
	const result = await multiply(sum, 2);
	return result;
}

/** Parallel: Promise.all */
export async function parallelMath() {
	"use workflow";
	const [a, b, c] = await Promise.all([
		add(10, 5),
		multiply(3, 7),
		add(100, 200),
	]);
	return { a, b, c };
}

/** Conditional: if/else */
export async function conditionalMath(x: number) {
	"use workflow";
	const doubled = await multiply(x, 2);
	if (doubled > 20) {
		return await add(doubled, 100);
	}
	return await add(doubled, 1);
}
