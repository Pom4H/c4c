import { applyPolicies } from "../core/executor.js";
import type { ExecutionContext, Procedure } from "../core/types.js";
import { addContract, multiplyContract } from "../contracts/math.js";
import { withLogging, withSpan } from "../policies/index.js";

/**
 * Add numbers handler
 */
export const add: Procedure<{ a: number; b: number }, { result: number }> = {
	contract: addContract,
	handler: applyPolicies(
		async (input: { a: number; b: number }, _context: ExecutionContext) => {
			return {
				result: input.a + input.b,
			};
		},
		withLogging("math.add"),
		withSpan("math.add", { operation: "calculation" })
	),
};

/**
 * Multiply numbers handler
 */
export const multiply: Procedure<{ a: number; b: number }, { result: number }> = {
	contract: multiplyContract,
	handler: applyPolicies(
		async (input: { a: number; b: number }, _context: ExecutionContext) => {
			return {
				result: input.a * input.b,
			};
		},
		withLogging("math.multiply"),
		withSpan("math.multiply", { operation: "calculation" })
	),
};
