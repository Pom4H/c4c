import type { Procedure } from "@tsdev/core";
import { addContract, multiplyContract, subtractContract } from "../contracts/math.js";

/**
 * Addition procedure
 */
export const add: Procedure = {
  contract: addContract,
  handler: async (input) => {
    return { result: input.a + input.b };
  },
};

/**
 * Multiplication procedure
 */
export const multiply: Procedure = {
  contract: multiplyContract,
  handler: async (input) => {
    return { result: input.a * input.b };
  },
};

/**
 * Subtraction procedure
 */
export const subtract: Procedure = {
  contract: subtractContract,
  handler: async (input) => {
    return { result: input.a - input.b };
  },
};
