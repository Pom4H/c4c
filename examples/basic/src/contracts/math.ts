import { z } from "zod";
import type { Contract } from "@c4c/core";

/**
 * Addition contract
 */
export const addContract: Contract = {
  name: "math.add",
  description: "Add two numbers",
  input: z.object({
    a: z.number(),
    b: z.number(),
  }),
  output: z.object({
    result: z.number(),
  }),
  metadata: {
    tags: ["math"],
  },
};

/**
 * Multiplication contract
 */
export const multiplyContract: Contract = {
  name: "math.multiply",
  description: "Multiply two numbers",
  input: z.object({
    a: z.number(),
    b: z.number(),
  }),
  output: z.object({
    result: z.number(),
  }),
  metadata: {
    tags: ["math"],
  },
};

/**
 * Subtraction contract
 */
export const subtractContract: Contract = {
  name: "math.subtract",
  description: "Subtract two numbers",
  input: z.object({
    a: z.number(),
    b: z.number(),
  }),
  output: z.object({
    result: z.number(),
  }),
  metadata: {
    tags: ["math"],
  },
};
