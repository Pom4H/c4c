/**
 * Demo procedures for examples and testing
 * Contract-first procedures ready to use
 */

import { z } from "zod";
import type { Procedure } from "../core/types.js";

/**
 * Add two numbers
 */
export const mathAdd: Procedure<
	{ a: number; b: number },
	{ result: number }
> = {
	contract: {
		name: "math.add",
		description: "Add two numbers",
		input: z.object({
			a: z.number().describe("First number"),
			b: z.number().describe("Second number"),
		}),
		output: z.object({
			result: z.number().describe("Sum of a and b"),
		}),
	},
	handler: async (input) => {
		// Simulate async operation
		await new Promise((resolve) => setTimeout(resolve, 300));
		return { result: input.a + input.b };
	},
};

/**
 * Multiply two numbers
 */
export const mathMultiply: Procedure<
	{ a: number; b?: number; result?: number },
	{ result: number }
> = {
	contract: {
		name: "math.multiply",
		description: "Multiply two numbers",
		input: z.object({
			a: z.number().describe("First number"),
			b: z.number().optional().describe("Second number (optional)"),
			result: z.number().optional().describe("Result from previous step"),
		}),
		output: z.object({
			result: z.number().describe("Product"),
		}),
	},
	handler: async (input) => {
		await new Promise((resolve) => setTimeout(resolve, 400));
		const b = input.b ?? input.result ?? 1;
		return { result: input.a * b };
	},
};

/**
 * Subtract two numbers
 */
export const mathSubtract: Procedure<
	{ a: number; b: number },
	{ result: number }
> = {
	contract: {
		name: "math.subtract",
		description: "Subtract two numbers",
		input: z.object({
			a: z.number().describe("First number"),
			b: z.number().describe("Second number"),
		}),
		output: z.object({
			result: z.number().describe("Difference"),
		}),
	},
	handler: async (input) => {
		await new Promise((resolve) => setTimeout(resolve, 400));
		return { result: input.a - input.b };
	},
};

/**
 * Format greeting message
 */
export const greet: Procedure<{ name: string }, { message: string }> = {
	contract: {
		name: "greet",
		description: "Generate greeting message",
		input: z.object({
			name: z.string().describe("Name to greet"),
		}),
		output: z.object({
			message: z.string().describe("Greeting message"),
		}),
	},
	handler: async (input) => {
		await new Promise((resolve) => setTimeout(resolve, 200));
		return { message: `Hello, ${input.name}! 👋` };
	},
};

/**
 * Fetch user data (mock)
 */
export const fetchData: Procedure<
	{ userId: string },
	{ userId: string; name: string; isPremium: boolean; data: { score: number } }
> = {
	contract: {
		name: "data.fetch",
		description: "Fetch user data",
		input: z.object({
			userId: z.string().describe("User ID"),
		}),
		output: z.object({
			userId: z.string(),
			name: z.string(),
			isPremium: z.boolean(),
			data: z.object({
				score: z.number(),
			}),
		}),
	},
	handler: async (input) => {
		await new Promise((resolve) => setTimeout(resolve, 700));
		return {
			userId: input.userId,
			name: "John Doe",
			isPremium: true,
			data: { score: 95 },
		};
	},
};

/**
 * Process data
 */
export const processData: Procedure<
	{ mode: string },
	{ processedData: string; score: number }
> = {
	contract: {
		name: "data.process",
		description: "Process data based on mode",
		input: z.object({
			mode: z.string().describe("Processing mode"),
		}),
		output: z.object({
			processedData: z.string(),
			score: z.number(),
		}),
	},
	handler: async (input) => {
		await new Promise((resolve) => setTimeout(resolve, 800));
		return {
			processedData: `${input.mode} processing completed`,
			score: 100,
		};
	},
};

/**
 * Save data
 */
export const saveData: Procedure<
	Record<string, unknown>,
	{ saved: boolean; timestamp: number }
> = {
	contract: {
		name: "data.save",
		description: "Save data to storage",
		input: z.record(z.unknown()),
		output: z.object({
			saved: z.boolean(),
			timestamp: z.number(),
		}),
	},
	handler: async () => {
		await new Promise((resolve) => setTimeout(resolve, 500));
		return { saved: true, timestamp: Date.now() };
	},
};

/**
 * All demo procedures as a record
 */
export const demoProcedures = {
	"math.add": mathAdd,
	"math.multiply": mathMultiply,
	"math.subtract": mathSubtract,
	greet: greet,
	"data.fetch": fetchData,
	"data.process": processData,
	"data.save": saveData,
} as const;

/**
 * Demo procedures as an array
 */
export const demoProceduresArray = [
	mathAdd,
	mathMultiply,
	mathSubtract,
	greet,
	fetchData,
	processData,
	saveData,
] as const;
