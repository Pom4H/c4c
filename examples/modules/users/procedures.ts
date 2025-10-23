/**
 * User procedures
 * These procedures use modular components (database, validators)
 */

import { z } from "zod";
import type { Procedure } from "@c4c/core";
import { userDatabase } from "./database.js";
import { validateEmail, validateUserRole, sanitizeName } from "./validators.js";

// Create User
export const createUser: Procedure = {
  contract: {
    name: "users.create",
    description: "Create a new user account",
    input: z.object({
      name: z.string().min(1),
      email: z.string().email(),
      role: z.string().default("user"),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      role: z.string(),
      createdAt: z.string(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      category: "users",
      tags: ["users", "create"],
    },
  },
  handler: async ({ name, email, role = "user" }) => {
    // Validate email
    if (!validateEmail(email)) {
      throw new Error("Invalid email format");
    }

    // Validate role
    if (!validateUserRole(role)) {
      throw new Error(`Invalid role. Must be one of: admin, user, moderator, guest`);
    }

    // Check if user already exists
    const existing = await userDatabase.findByEmail(email);
    if (existing) {
      throw new Error("User with this email already exists");
    }

    // Sanitize and create user
    const sanitizedName = sanitizeName(name);
    const user = await userDatabase.create({
      name: sanitizedName,
      email,
      role,
    });

    return user;
  },
};

// Get User by ID
export const getUser: Procedure = {
  contract: {
    name: "users.get",
    description: "Get user by ID",
    input: z.object({
      id: z.string(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      role: z.string(),
      createdAt: z.string(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      category: "users",
      tags: ["users", "read"],
    },
  },
  handler: async ({ id }) => {
    const user = await userDatabase.findById(id);
    if (!user) {
      throw new Error(`User not found: ${id}`);
    }
    return user;
  },
};

// List Users
export const listUsers: Procedure = {
  contract: {
    name: "users.list",
    description: "List all users",
    input: z.object({}),
    output: z.object({
      users: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          role: z.string(),
          createdAt: z.string(),
        })
      ),
      count: z.number(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      category: "users",
      tags: ["users", "read"],
    },
  },
  handler: async () => {
    const users = await userDatabase.list();
    return {
      users,
      count: users.length,
    };
  },
};

// Update User
export const updateUser: Procedure = {
  contract: {
    name: "users.update",
    description: "Update user information",
    input: z.object({
      id: z.string(),
      name: z.string().optional(),
      role: z.string().optional(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      role: z.string(),
      createdAt: z.string(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      category: "users",
      tags: ["users", "update"],
    },
  },
  handler: async ({ id, name, role }) => {
    // Validate role if provided
    if (role && !validateUserRole(role)) {
      throw new Error(`Invalid role. Must be one of: admin, user, moderator, guest`);
    }

    // Sanitize name if provided
    const sanitizedName = name ? sanitizeName(name) : undefined;

    const updated = await userDatabase.update(id, {
      name: sanitizedName,
      role,
    });

    if (!updated) {
      throw new Error(`User not found: ${id}`);
    }

    return updated;
  },
};

// Delete User
export const deleteUser: Procedure = {
  contract: {
    name: "users.delete",
    description: "Delete a user",
    input: z.object({
      id: z.string(),
    }),
    output: z.object({
      success: z.boolean(),
      id: z.string(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      category: "users",
      tags: ["users", "delete"],
    },
  },
  handler: async ({ id }) => {
    const success = await userDatabase.delete(id);
    if (!success) {
      throw new Error(`User not found: ${id}`);
    }
    return { success, id };
  },
};
