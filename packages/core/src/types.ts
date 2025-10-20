import type { z } from "zod";

export type ProcedureExposure = "external" | "internal";
export type ProcedureRole = "workflow-node" | "api-endpoint" | "sdk-client";

export interface AuthRequirements {
	/**
	 * Whether this procedure requires authentication
	 */
	requiresAuth?: boolean;
	/**
	 * Required roles for this procedure
	 */
	requiredRoles?: string[];
	/**
	 * Required permissions for this procedure
	 */
	requiredPermissions?: string[];
	/**
	 * Authentication scheme (Bearer, Basic, ApiKey, etc.)
	 */
	authScheme?: string;
}

export interface ContractMetadata extends Record<string, unknown> {
	exposure?: ProcedureExposure;
	roles?: ProcedureRole[];
	category?: string;
	tags?: string[];
	/**
	 * Authentication and authorization requirements
	 */
	auth?: AuthRequirements;
}

/**
 * Context passed to every handler execution
 */
export interface ExecutionContext {
	requestId: string;
	timestamp: Date;
	metadata: Record<string, unknown>;
}

/**
 * Contract definition for a procedure
 */
export interface Contract<TInput = unknown, TOutput = unknown> {
	name: string;
	description?: string;
	input: z.ZodType<TInput>;
	output: z.ZodType<TOutput>;
	metadata?: ContractMetadata;
}

/**
 * Handler function signature
 */
export type Handler<TInput = unknown, TOutput = unknown> = (
	input: TInput,
	context: ExecutionContext
) => Promise<TOutput> | TOutput;

/**
 * Procedure combines contract with handler
 */
export interface Procedure<TInput = unknown, TOutput = unknown> {
	contract: Contract<TInput, TOutput>;
	handler: Handler<TInput, TOutput>;
}

/**
 * Registry of all procedures
 */
export type Registry = Map<string, Procedure>;

/**
 * Policy function that wraps a handler
 */
export type Policy = <TInput, TOutput>(
	handler: Handler<TInput, TOutput>
) => Handler<TInput, TOutput>;
