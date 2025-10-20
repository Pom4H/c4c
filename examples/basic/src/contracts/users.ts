import { z } from "zod";
import type { Contract } from "@c4c/core";

/**
 * User creation contract
 */
export const createUserContract: Contract = {
  name: "users.create",
  description: "Create a new user",
  input: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.string(),
  }),
  metadata: {
    tags: ["users", "write"],
  },
};

/**
 * Get user contract
 */
export const getUserContract: Contract = {
  name: "users.get",
  description: "Get user by ID",
  input: z.object({
    id: z.string(),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.string(),
  }),
  metadata: {
    tags: ["users", "read"],
  },
};
