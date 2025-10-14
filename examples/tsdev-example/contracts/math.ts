import { z } from "zod";
import type { Contract } from "../core/types.js";

/**
 * Simple math contracts to demonstrate the framework
 */

export const addContract: Contract<{ a: number; b: number }, { result: number }> = {
	name: "math.add",
	description: "Add two numbers",
	input: z.object({
		a: z.number(),
		b: z.number(),
	}),
	output: z.object({
		result: z.number(),
	}),
	metadata: {
		tags: ["math", "calculation"],
	},
};

export const multiplyContract: Contract<{ a: number; b: number }, { result: number }> = {
	name: "math.multiply",
	description: "Multiply two numbers",
	input: z.object({
		a: z.number(),
		b: z.number(),
	}),
	output: z.object({
		result: z.number(),
	}),
	metadata: {
		tags: ["math", "calculation"],
	},
};
