/**
 * Enhanced type guards with runtime validation
 */

import { z } from "zod";
import type { Contract, ExecutionContext, Handler, Procedure } from "./types.js";

/**
 * Schema for validating Contract structure
 */
const ContractSchema = z.object({
	name: z.string().optional(),
	description: z.string().optional(),
	input: z.custom<z.ZodType>((val) => {
		return val != null && typeof val === "object" && "_def" in val;
	}),
	output: z.custom<z.ZodType>((val) => {
		return val != null && typeof val === "object" && "_def" in val;
	}),
	metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema for validating Procedure structure
 */
const ProcedureSchema = z.object({
	contract: ContractSchema,
	handler: z.function(),
});

/**
 * Enhanced type guard for Contract
 */
export function isContract(value: unknown): value is Contract {
	return ContractSchema.safeParse(value).success;
}

/**
 * Enhanced type guard for Procedure
 */
export function isProcedure(value: unknown): value is Procedure {
	return ProcedureSchema.safeParse(value).success;
}

/**
 * Type guard for Handler function
 */
export function isHandler(value: unknown): value is Handler {
	return typeof value === "function";
}

/**
 * Type guard for ExecutionContext
 */
export function isExecutionContext(value: unknown): value is ExecutionContext {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const ctx = value as Record<string, unknown>;
	return (
		typeof ctx.requestId === "string" &&
		ctx.timestamp instanceof Date &&
		typeof ctx.metadata === "object" &&
		ctx.metadata !== null
	);
}

/**
 * Validate and assert Contract
 */
export function assertContract(value: unknown, message?: string): asserts value is Contract {
	if (!isContract(value)) {
		throw new Error(message ?? "Invalid Contract structure");
	}
}

/**
 * Validate and assert Procedure
 */
export function assertProcedure(value: unknown, message?: string): asserts value is Procedure {
	if (!isProcedure(value)) {
		throw new Error(message ?? "Invalid Procedure structure");
	}
}

/**
 * Validate and assert Handler
 */
export function assertHandler(value: unknown, message?: string): asserts value is Handler {
	if (!isHandler(value)) {
		throw new Error(message ?? "Invalid Handler - must be a function");
	}
}

/**
 * Validate and assert ExecutionContext
 */
export function assertExecutionContext(
	value: unknown,
	message?: string
): asserts value is ExecutionContext {
	if (!isExecutionContext(value)) {
		throw new Error(message ?? "Invalid ExecutionContext structure");
	}
}

/**
 * Type guard for checking if procedure has specific metadata
 */
export function hasProcedureMetadata<K extends string>(
	procedure: Procedure,
	key: K
): procedure is Procedure & { contract: { metadata: Record<K, unknown> } } {
	return (
		procedure.contract.metadata != null &&
		typeof procedure.contract.metadata === "object" &&
		key in procedure.contract.metadata
	);
}

/**
 * Type guard for checking procedure exposure
 */
export function hasExposure(procedure: Procedure, exposure: "external" | "internal"): boolean {
	return procedure.contract.metadata?.exposure === exposure;
}

/**
 * Type guard for checking procedure role
 */
export function hasRole(
	procedure: Procedure,
	role: "workflow-node" | "api-endpoint" | "sdk-client" | "trigger"
): boolean {
	return procedure.contract.metadata?.roles?.includes(role) ?? false;
}

/**
 * Type guard for trigger procedures
 */
export function isTriggerProcedure(procedure: Procedure): boolean {
	return (
		procedure.contract.metadata?.type === "trigger" ||
		procedure.contract.metadata?.roles?.includes("trigger") ||
		procedure.contract.metadata?.trigger != null
	);
}

/**
 * Validate procedure at runtime with detailed error messages
 */
export function validateProcedure(procedure: unknown): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (typeof procedure !== "object" || procedure === null) {
		errors.push("Procedure must be an object");
		return { valid: false, errors };
	}

	const proc = procedure as Record<string, unknown>;

	// Check contract
	if (!("contract" in proc)) {
		errors.push("Procedure must have 'contract' property");
	} else if (!isContract(proc.contract)) {
		errors.push("Invalid contract structure");
	}

	// Check handler
	if (!("handler" in proc)) {
		errors.push("Procedure must have 'handler' property");
	} else if (typeof proc.handler !== "function") {
		errors.push("Handler must be a function");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
