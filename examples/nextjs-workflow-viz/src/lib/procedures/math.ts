/**
 * Math procedures with contracts
 * Real tsdev framework procedures
 */

import { z } from "zod";
import type { Procedure } from "@tsdev/core/types.js";

/**
 * Add two numbers
 */
export const addProcedure: Procedure<
  { a: number; b: number },
  { result: number }
> = {
  contract: {
    name: "math.add",
    input: z.object({
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    }),
    output: z.object({
      result: z.number().describe("Sum of a and b"),
    }),
  },
  handler: async (input, _ctx) => {
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { result: input.a + input.b };
  },
};

/**
 * Multiply two numbers
 */
export const multiplyProcedure: Procedure<
  { a: number; b?: number; result?: number },
  { result: number }
> = {
  contract: {
    name: "math.multiply",
    input: z.object({
      a: z.number().describe("First number"),
      b: z.number().optional().describe("Second number"),
      result: z.number().optional().describe("Result from previous step"),
    }),
    output: z.object({
      result: z.number().describe("Product of a and b"),
    }),
  },
  handler: async (input, _ctx) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const b = input.b ?? input.result ?? 1;
    return { result: input.a * b };
  },
};

/**
 * Subtract two numbers
 */
export const subtractProcedure: Procedure<
  { a: number; b: number },
  { result: number }
> = {
  contract: {
    name: "math.subtract",
    input: z.object({
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    }),
    output: z.object({
      result: z.number().describe("Difference of a and b"),
    }),
  },
  handler: async (input, _ctx) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { result: input.a - input.b };
  },
};
