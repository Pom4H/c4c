import { createUserContract, getUserContract, listUsersContract } from "../contracts/users.js";
import { applyPolicies } from "../core/executor.js";
import type { ExecutionContext, Procedure } from "../core/types.js";
import { withLogging, withRateLimit, withRetry, withSpan } from "../policies/index.js";

/**
 * In-memory user storage (for demo purposes)
 */
interface User {
	id: string;
	name: string;
	email: string;
	createdAt: string;
}

const users: User[] = [];

/**
 * Create user handler
 * Demonstrates composable policies and transport-agnostic logic
 */
export const createUser: Procedure<
	{ name: string; email: string },
	{ id: string; name: string; email: string; createdAt: string }
> = {
	contract: createUserContract,
	handler: applyPolicies(
		async (input: { name: string; email: string }, _context: ExecutionContext) => {
			// Pure business logic - doesn't know about transport
			const user: User = {
				id: crypto.randomUUID(),
				name: input.name,
				email: input.email,
				createdAt: new Date().toISOString(),
			};

			users.push(user);

			return user;
		},
		withLogging("users.create"),
		withSpan("users.create", { operation: "create" }),
		withRateLimit({ maxTokens: 5, refillRate: 1 })
	),
};

/**
 * Get user handler
 */
export const getUser: Procedure<{ id: string }, { id: string; name: string; email: string }> = {
	contract: getUserContract,
	handler: applyPolicies(
		async (input: { id: string }, _context: ExecutionContext) => {
			const user = users.find((u) => u.id === input.id);

			if (!user) {
				throw new Error(`User with id ${input.id} not found`);
			}

			return {
				id: user.id,
				name: user.name,
				email: user.email,
			};
		},
		withLogging("users.get"),
		withSpan("users.get", { operation: "read" }),
		withRetry({ maxAttempts: 2, delayMs: 50 })
	),
};

/**
 * List users handler
 */
export const listUsers: Procedure<
	{ limit?: number; offset?: number },
	{ users: Array<{ id: string; name: string; email: string }>; total: number }
> = {
	contract: listUsersContract,
	handler: applyPolicies(
		async (input: { limit?: number; offset?: number }, _context: ExecutionContext) => {
			const limit = input.limit ?? 10;
			const offset = input.offset ?? 0;

			const paginatedUsers = users
				.slice(offset, offset + limit)
				.map((u) => ({ id: u.id, name: u.name, email: u.email }));

			return {
				users: paginatedUsers,
				total: users.length,
			};
		},
		withLogging("users.list"),
		withSpan("users.list", { operation: "read" })
	),
};
