import { z } from "zod";
import type { Contract } from "../core/types.js";

/**
 * User domain contracts
 * These are the single source of truth for user-related procedures
 */

export const createUserContract: Contract<
	{ name: string; email: string },
	{ id: string; name: string; email: string; createdAt: string }
> = {
	name: "users.create",
	description: "Create a new user",
	input: z.object({
		name: z.string().min(1, "Name is required"),
		email: z.string().email("Valid email is required"),
	}),
	output: z.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		createdAt: z.string(),
	}),
	metadata: {
		tags: ["users", "write"],
		rateLimit: { maxTokens: 5, refillRate: 1 },
	},
};

export const getUserContract: Contract<{ id: string }, { id: string; name: string; email: string }> =
	{
		name: "users.get",
		description: "Get user by ID",
		input: z.object({
			id: z.string().uuid("Valid UUID required"),
		}),
		output: z.object({
			id: z.string(),
			name: z.string(),
			email: z.string(),
		}),
		metadata: {
			tags: ["users", "read"],
		},
	};

export const listUsersContract: Contract<
	{ limit?: number; offset?: number },
	{ users: Array<{ id: string; name: string; email: string }>; total: number }
> = {
	name: "users.list",
	description: "List all users with pagination",
	input: z.object({
		limit: z.number().int().positive().max(100).optional().default(10),
		offset: z.number().int().nonnegative().optional().default(0),
	}),
	output: z.object({
		users: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				email: z.string(),
			})
		),
		total: z.number(),
	}),
	metadata: {
		tags: ["users", "read"],
	},
};
