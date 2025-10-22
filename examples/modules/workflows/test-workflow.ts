/**
 * Test workflow for demonstrating c4c exec workflow command
 */

import { workflow, step } from "@c4c/workflow";
import { z } from "zod";

// Create a user
const createUserStep = step({
  id: "createUser",
  input: z.object({
    name: z.string(),
    email: z.string(),
    role: z.string().default("user"),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    createdAt: z.string(),
  }),
  execute: ({ engine, inputData }) => engine.run("users.create", inputData),
});

// Create a product
const createProductStep = step({
  id: "createProduct",
  input: z.object({
    name: z.string(),
    description: z.string(),
    price: z.number(),
    stock: z.number(),
    category: z.string(),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    price: z.number(),
    stock: z.number(),
    category: z.string(),
    createdAt: z.string(),
  }),
  execute: ({ engine, inputData }) => engine.run("products.create", inputData),
});

// Get analytics
const getAnalyticsStep = step({
  id: "getAnalytics",
  input: z.object({}),
  output: z.object({
    users: z.object({
      total: z.number(),
      byRole: z.record(z.string(), z.number()),
    }),
    products: z.object({
      total: z.number(),
      totalValue: z.number(),
      byCategory: z.record(z.string(), z.number()),
    }),
    timestamp: z.string(),
  }),
  execute: ({ engine }) => engine.run("analytics.stats", {}),
});

// Build the workflow
export default workflow("test-workflow")
  .step(createUserStep)
  .step(createProductStep)
  .step(getAnalyticsStep)
  .commit();
