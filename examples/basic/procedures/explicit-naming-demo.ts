import { z } from "zod";
import type { Procedure } from "@c4c/core";

/**
 * Demo: Explicit naming procedures
 * 
 * These procedures explicitly specify contract.name.
 * Use this approach for public APIs where you need stable names.
 * 
 * Benefits:
 * - Stable API names (namespaced, versioned)
 * - Better REST mapping
 * - Clear documentation
 */

// ✅ Explicit naming example 1: Namespaced
export const create: Procedure = {
  contract: {
    name: "users.create",  // ← Explicit name
    description: "Creates a new user",
    input: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      category: "users",
      tags: ["users", "write"],
    },
  },
  handler: async (input) => ({
    id: `user_${Date.now()}`,
    ...input,
  }),
};

// ✅ Explicit naming example 2: Versioned API
export const getUserV2: Procedure = {
  contract: {
    name: "users.v2.get",  // ← Versioned name
    description: "Gets user by ID (v2 with extended data)",
    input: z.object({
      id: z.string(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      createdAt: z.string(),
      metadata: z.record(z.string(), z.unknown()),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      category: "users",
      tags: ["users", "read", "v2"],
    },
  },
  handler: async ({ id }) => ({
    id,
    name: "Example User",
    email: "user@example.com",
    createdAt: new Date().toISOString(),
    metadata: { version: 2 },
  }),
};

// ✅ Explicit naming example 3: REST mapping
export const listProducts: Procedure = {
  contract: {
    name: "products.list",  // ← Maps to GET /products
    description: "Lists all products",
    input: z.object({
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
    output: z.object({
      items: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          price: z.number(),
        })
      ),
      total: z.number(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      category: "products",
      tags: ["products", "read"],
    },
  },
  handler: async ({ limit = 10, offset = 0 }) => ({
    items: [
      { id: "prod_1", name: "Product 1", price: 99.99 },
      { id: "prod_2", name: "Product 2", price: 149.99 },
    ],
    total: 2,
  }),
};

/**
 * Usage:
 * 
 * c4c exec users.create --input '{"name":"Alice","email":"alice@example.com"}'
 * c4c exec users.v2.get --input '{"id":"user_123"}'
 * c4c exec products.list --input '{"limit":10}'
 * 
 * REST endpoints:
 * POST /users
 * GET /users/:id
 * GET /products
 * 
 * Benefits:
 * 1. Stable API names
 * 2. Versioning support
 * 3. Clear namespacing
 * 4. REST compatibility
 */
