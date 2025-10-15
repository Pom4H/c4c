import type { Procedure } from "@tsdev/core";
import { createUserContract, getUserContract } from "../contracts/users.js";

// Mock database
const users = new Map<string, any>();

export const createUser: Procedure = {
	contract: createUserContract,
	handler: async (input) => {
		const id = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
		const user = {
			id,
			name: input.name,
			email: input.email,
			createdAt: new Date().toISOString(),
		};

		users.set(id, user);

		console.log(`[users.create] Created user: ${user.id}`);

		return user;
	},
};

export const getUser: Procedure = {
	contract: getUserContract,
	handler: async (input) => {
		const user = users.get(input.id);

		if (!user) {
			throw new Error(`User ${input.id} not found`);
		}

		console.log(`[users.get] Retrieved user: ${user.id}`);

		return user;
	},
};
