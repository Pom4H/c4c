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
 * Base metadata structure with common fields
 */
export interface BaseMetadata {
	/**
	 * Authentication data
	 */
	auth?: {
		userId?: string;
		username?: string;
		email?: string;
		roles?: string[];
		permissions?: string[];
		token?: string;
		expiresAt?: Date | string;
		[key: string]: unknown;
	};
	/**
	 * User ID (extracted from auth for convenience)
	 */
	userId?: string;
	/**
	 * OAuth tokens and data
	 */
	oauth?: {
		accessToken?: string;
		refreshToken?: string;
		expiresAt?: Date;
		scope?: string[];
		provider?: string;
		[key: string]: unknown;
	};
	/**
	 * Request tracing and correlation
	 */
	traceId?: string;
	spanId?: string;
	parentSpanId?: string;
	/**
	 * Additional custom metadata
	 */
	[key: string]: unknown;
}

/**
 * Context passed to every handler execution
 * Generic type parameter allows type-safe metadata
 */
export interface ExecutionContext<TMeta extends BaseMetadata = BaseMetadata> {
	requestId: string;
	timestamp: Date;
	metadata: TMeta;
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
 * Handler function signature with typed context
 */
export type Handler<
	TInput = unknown,
	TOutput = unknown,
	TContext extends ExecutionContext = ExecutionContext,
> = (input: TInput, context: TContext) => Promise<TOutput> | TOutput;

/**
 * Procedure combines contract with handler
 * Generic context type allows type-safe metadata flow
 */
export interface Procedure<
	TInput = unknown,
	TOutput = unknown,
	TContext extends ExecutionContext = ExecutionContext,
> {
	contract: Contract<TInput, TOutput>;
	handler: Handler<TInput, TOutput, TContext>;
}

/**
 * Registry of all procedures
 */
export type Registry = Map<string, Procedure>;

/**
 * Policy function that wraps a handler
 * Can transform context type (e.g., add auth data)
 *
 * @example
 * // Policy that adds OAuth data to context
 * const withOAuth: Policy<ExecutionContext, ExecutionContext & { oauth: OAuthData }> =
 *   (handler) => async (input, context) => {
 *     const oauthData = await getOAuthData();
 *     return handler(input, { ...context, metadata: { ...context.metadata, oauth: oauthData } });
 *   };
 */
export type Policy<
	TContextIn extends ExecutionContext = ExecutionContext,
	TContextOut extends ExecutionContext = TContextIn,
> = <TInput, TOutput>(
	handler: Handler<TInput, TOutput, TContextOut>
) => Handler<TInput, TOutput, TContextIn>;

/**
 * Simple policy that doesn't transform context
 */
export type SimplePolicy = Policy<ExecutionContext, ExecutionContext>;
