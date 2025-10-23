import { z } from "zod";
import type { Procedure } from "@c4c/core";

/**
 * Demo: Auto-naming procedures
 * 
 * These procedures don't specify contract.name explicitly.
 * They use export name as the procedure name.
 * 
 * Benefits:
 * - IDE refactoring works (F2 rename)
 * - Less boilerplate
 * - DRY principle
 */

// ✅ Auto-naming example 1: Simple procedure
export const greet: Procedure = {
  contract: {
    // name is auto-generated from export name: "greet"
    description: "Greets a user by name",
    input: z.object({
      name: z.string(),
    }),
    output: z.object({
      message: z.string(),
    }),
  },
  handler: async ({ name }) => ({
    message: `Hello, ${name}!`,
  }),
};

// ✅ Auto-naming example 2: Calculation
export const calculateDiscount: Procedure = {
  contract: {
    // name is auto-generated: "calculateDiscount"
    description: "Calculates discount amount",
    input: z.object({
      price: z.number(),
      discountPercent: z.number(),
    }),
    output: z.object({
      originalPrice: z.number(),
      discount: z.number(),
      finalPrice: z.number(),
    }),
  },
  handler: async ({ price, discountPercent }) => {
    const discount = (price * discountPercent) / 100;
    return {
      originalPrice: price,
      discount,
      finalPrice: price - discount,
    };
  },
};

// ✅ Auto-naming example 3: Validation
export const validateEmail: Procedure = {
  contract: {
    // name is auto-generated: "validateEmail"
    description: "Validates email format",
    input: z.object({
      email: z.string(),
    }),
    output: z.object({
      valid: z.boolean(),
      reason: z.string().optional(),
    }),
  },
  handler: async ({ email }) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = emailRegex.test(email);
    
    return {
      valid,
      reason: valid ? undefined : "Invalid email format",
    };
  },
};

/**
 * Usage:
 * 
 * c4c exec greet --input '{"name":"Alice"}'
 * c4c exec calculateDiscount --input '{"price":100,"discountPercent":20}'
 * c4c exec validateEmail --input '{"email":"test@example.com"}'
 * 
 * Benefits:
 * 1. Rename "greet" → IDE updates everywhere
 * 2. No manual string updates
 * 3. Single source of truth
 */
