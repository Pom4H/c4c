/**
 * Demo procedures using tsdev framework
 */

import { z } from "zod";
import type { Procedure } from "../../../dist/core/types.js";

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
      a: z.number(),
      b: z.number(),
    }),
    output: z.object({
      result: z.number(),
    }),
  },
  handler: async (input) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
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
      a: z.number(),
      b: z.number().optional(),
      result: z.number().optional(),
    }),
    output: z.object({
      result: z.number(),
    }),
  },
  handler: async (input) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const b = input.b ?? input.result ?? 1;
    return { result: input.a * b };
  },
};

/**
 * Format greeting message
 */
export const greetProcedure: Procedure<
  { name: string },
  { message: string }
> = {
  contract: {
    name: "greet",
    input: z.object({
      name: z.string(),
    }),
    output: z.object({
      message: z.string(),
    }),
  },
  handler: async (input) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { message: `Hello, ${input.name}! 👋` };
  },
};
