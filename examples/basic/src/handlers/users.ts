import type { Procedure } from "@tsdev/core";
import { createUserContract, getUserContract } from "../contracts/users.js";

// In-memory storage for demo
const users = new Map<string, { id: string; name: string; email: string; createdAt: string }>();

/**
 * Create user procedure
 */
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
    return user;
  },
};

/**
 * Get user procedure
 */
export const getUser: Procedure = {
  contract: getUserContract,
  handler: async (input) => {
    const user = users.get(input.id);
    if (!user) {
      throw new Error(`User with id ${input.id} not found`);
    }
    return user;
  },
};
