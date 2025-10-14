/**
 * Data procedures with contracts
 * Real tsdev framework procedures
 */

import { z } from "zod";
import type { Procedure } from "@tsdev/core/types.js";

/**
 * Fetch user data
 */
export const fetchDataProcedure: Procedure<
  { userId: string },
  { userId: string; name: string; isPremium: boolean; data: { score: number } }
> = {
  contract: {
    name: "data.fetch",
    input: z.object({
      userId: z.string().describe("User ID"),
    }),
    output: z.object({
      userId: z.string(),
      name: z.string(),
      isPremium: z.boolean(),
      data: z.object({
        score: z.number(),
      }),
    }),
  },
  handler: async (input, ctx) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return {
      userId: input.userId,
      name: "John Doe",
      isPremium: true,
      data: { score: 95 },
    };
  },
};

/**
 * Process data
 */
export const processDataProcedure: Procedure<
  { mode: string },
  { processedData: string; score: number }
> = {
  contract: {
    name: "data.process",
    input: z.object({
      mode: z.string().describe("Processing mode"),
    }),
    output: z.object({
      processedData: z.string(),
      score: z.number(),
    }),
  },
  handler: async (input, ctx) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      processedData: `${input.mode} processing completed`,
      score: 100,
    };
  },
};

/**
 * Save data
 */
export const saveDataProcedure: Procedure<
  Record<string, unknown>,
  { saved: boolean; timestamp: number }
> = {
  contract: {
    name: "data.save",
    input: z.record(z.unknown()),
    output: z.object({
      saved: z.boolean(),
      timestamp: z.number(),
    }),
  },
  handler: async (input, ctx) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { saved: true, timestamp: Date.now() };
  },
};
