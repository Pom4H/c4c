import type { z } from "zod";

export type ProcedureExposure = "external" | "internal";
export type ProcedureRole = "workflow-node" | "api-endpoint" | "sdk-client" | "trigger";
export type ProcedureType = "action" | "trigger";

/**
 * Trigger-specific metadata for webhook/subscription-based procedures
 */
export interface TriggerMetadata {
	/**
	 * Type of trigger (webhook, watch, poll, stream, etc.)
	 */
	type: "webhook" | "watch" | "poll" | "stream" | "subscription";
	/**
	 * Associated stop/unsubscribe procedure name (if exists)
	 */
	stopProcedure?: string;
	/**
	 * Whether this trigger requires active channel management
	 */
	requiresChannelManagement?: boolean;
	/**
	 * Expected event types this trigger can emit
	 */
	eventTypes?: string[];
	/**
	 * Polling interval in milliseconds (for poll-type triggers)
	 */
	pollingInterval?: number;
	/**
	 * Whether trigger supports filtering
	 */
	supportsFiltering?: boolean;
}

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
	/**
	 * Type of procedure - action (default) or trigger
	 */
	type?: ProcedureType;
	category?: string;
	tags?: string[];
	/**
	 * Authentication and authorization requirements
	 */
	auth?: AuthRequirements;
	/**
	 * Trigger-specific metadata (only for type: "trigger")
	 */
	trigger?: TriggerMetadata;
	/**
	 * Provider identifier (e.g., "googleDrive", "slack")
	 */
	provider?: string;
	/**
	 * Operation name within the provider
	 */
	operation?: string;
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
	/**
	 * Procedure name (optional - will use export name if not provided)
	 * 
	 * @example
	 * // Auto-naming (uses export name)
	 * export const createUser: Procedure = {
	 *   contract: { input: ..., output: ... },  // name = "createUser"
	 *   handler: ...
	 * };
	 * 
	 * // Explicit naming
	 * export const createUser: Procedure = {
	 *   contract: { name: "users.create", input: ..., output: ... },
	 *   handler: ...
	 * };
	 */
	name?: string;
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
