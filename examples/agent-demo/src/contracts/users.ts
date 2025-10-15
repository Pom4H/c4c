import { z } from "zod";
import type { Contract } from "@tsdev/core";

export const createUserContract: Contract = {
	name: "users.create",
	description: "Create a new user account",
	input: z.object({
		name: z.string().describe("User's full name"),
		email: z.string().email().describe("User's email address"),
	}),
	output: z.object({
		id: z.string().describe("Generated user ID"),
		name: z.string(),
		email: z.string(),
		createdAt: z.string().datetime(),
	}),
	metadata: {
		tags: ["users", "write"],
	},
};

export const getUserContract: Contract = {
	name: "users.get",
	description: "Get user by ID",
	input: z.object({
		id: z.string().describe("User ID"),
	}),
	output: z.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		createdAt: z.string().datetime(),
	}),
	metadata: {
		tags: ["users", "read"],
	},
};
