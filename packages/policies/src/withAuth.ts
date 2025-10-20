import type { ExecutionContext, Handler, Policy } from "@c4c/core";

export type AuthScheme = "Bearer" | "Basic" | "ApiKey" | "Custom";

export interface AuthPolicyOptions {
	/**
	 * Authentication scheme to use
	 */
	scheme?: AuthScheme;
	
	/**
	 * Key in execution context metadata where auth data is stored
	 * Defaults to "auth"
	 */
	metadataKey?: string;
	
	/**
	 * Required fields in the auth data object
	 * e.g., ["userId", "roles"]
	 */
	requiredFields?: string[];
	
	/**
	 * Required roles for authorization
	 * If specified, the auth data must contain a "roles" field
	 */
	requiredRoles?: string[];
	
	/**
	 * Required permissions for authorization
	 * If specified, the auth data must contain a "permissions" field
	 */
	requiredPermissions?: string[];
	
	/**
	 * Custom authorization callback
	 * Return true to allow, false to deny
	 */
	authorize?: (authData: AuthData, context: ExecutionContext) => boolean | Promise<boolean>;
	
	/**
	 * Custom error message when auth fails
	 */
	unauthorizedMessage?: string;
	
	/**
	 * Allow anonymous access (skip auth check but still extract auth data if present)
	 */
	allowAnonymous?: boolean;
	
	/**
	 * Extract user ID from auth data using this key
	 * Defaults to "userId"
	 */
	userIdKey?: string;
}

export interface AuthData {
	userId?: string;
	username?: string;
	email?: string;
	roles?: string[];
	permissions?: string[];
	token?: string;
	expiresAt?: Date | string;
	[key: string]: unknown;
}

const AUTH_METADATA_KEY = "auth";
const USER_ID_METADATA_KEY = "userId";

/**
 * Helper to extract auth data from execution context
 */
export function getAuthData(context: ExecutionContext, metadataKey = AUTH_METADATA_KEY): AuthData | null {
	const authData = context.metadata[metadataKey];
	if (!authData || typeof authData !== "object") {
		return null;
	}
	return authData as AuthData;
}

/**
 * Helper to extract user ID from auth data
 */
export function getUserId(context: ExecutionContext, userIdKey = "userId"): string | null {
	const authData = getAuthData(context);
	if (!authData) {
		return null;
	}
	return (authData[userIdKey] as string) ?? null;
}

/**
 * Helper to check if user has required role
 */
export function hasRole(context: ExecutionContext, role: string): boolean {
	const authData = getAuthData(context);
	if (!authData?.roles || !Array.isArray(authData.roles)) {
		return false;
	}
	return authData.roles.includes(role);
}

/**
 * Helper to check if user has required permission
 */
export function hasPermission(context: ExecutionContext, permission: string): boolean {
	const authData = getAuthData(context);
	if (!authData?.permissions || !Array.isArray(authData.permissions)) {
		return false;
	}
	return authData.permissions.includes(permission);
}

/**
 * Helper to check if user has any of the required roles
 */
export function hasAnyRole(context: ExecutionContext, roles: string[]): boolean {
	const authData = getAuthData(context);
	if (!authData?.roles || !Array.isArray(authData.roles)) {
		return false;
	}
	return roles.some(role => authData.roles!.includes(role));
}

/**
 * Helper to check if user has all required roles
 */
export function hasAllRoles(context: ExecutionContext, roles: string[]): boolean {
	const authData = getAuthData(context);
	if (!authData?.roles || !Array.isArray(authData.roles)) {
		return false;
	}
	return roles.every(role => authData.roles!.includes(role));
}

/**
 * Policy that validates authentication and authorization data from procedure context.
 *
 * This policy expects auth data to be present in the execution context metadata.
 * The auth data should be set by the adapter (HTTP, RPC, etc.) when calling the procedure.
 *
 * Features:
 * - Validates presence of auth data
 * - Checks required fields in auth data
 * - Validates required roles
 * - Validates required permissions
 * - Supports custom authorization logic
 * - Can allow anonymous access while still extracting auth data if present
 *
 * Example auth data structure in context.metadata.auth:
 * {
 *   userId: "123",
 *   username: "john.doe",
 *   email: "john@example.com",
 *   roles: ["admin", "user"],
 *   permissions: ["read:users", "write:users"],
 *   token: "jwt-token-here",
 *   expiresAt: "2025-12-31T23:59:59Z"
 * }
 */
export function withAuth(options: AuthPolicyOptions = {}): Policy {
	const {
		metadataKey = AUTH_METADATA_KEY,
		requiredFields = [],
		requiredRoles = [],
		requiredPermissions = [],
		authorize,
		unauthorizedMessage = "Unauthorized: Authentication required",
		allowAnonymous = false,
		userIdKey = "userId",
	} = options;

	return <TInput, TOutput>(handler: Handler<TInput, TOutput>): Handler<TInput, TOutput> => {
		return async (input, context) => {
			// Extract auth data from context
			const authData = getAuthData(context, metadataKey);

			// If no auth data and anonymous access not allowed, deny
			if (!authData && !allowAnonymous) {
				throw new Error(unauthorizedMessage);
			}

			// If we have auth data, perform validation
			if (authData) {
				// Validate required fields
				for (const field of requiredFields) {
					if (!(field in authData) || authData[field] === undefined || authData[field] === null) {
						throw new Error(`Unauthorized: Missing required auth field "${field}"`);
					}
				}

				// Validate required roles
				if (requiredRoles.length > 0) {
					if (!authData.roles || !Array.isArray(authData.roles)) {
						throw new Error("Unauthorized: User has no roles");
					}
					
					const hasRequiredRole = requiredRoles.some(role => authData.roles!.includes(role));
					if (!hasRequiredRole) {
						throw new Error(
							`Unauthorized: User must have one of the following roles: ${requiredRoles.join(", ")}`
						);
					}
				}

				// Validate required permissions
				if (requiredPermissions.length > 0) {
					if (!authData.permissions || !Array.isArray(authData.permissions)) {
						throw new Error("Unauthorized: User has no permissions");
					}
					
					const missingPermissions = requiredPermissions.filter(
						perm => !authData.permissions!.includes(perm)
					);
					
					if (missingPermissions.length > 0) {
						throw new Error(
							`Unauthorized: Missing permissions: ${missingPermissions.join(", ")}`
						);
					}
				}

				// Check token expiration if present
				if (authData.expiresAt) {
					const expiresAt = typeof authData.expiresAt === "string" 
						? new Date(authData.expiresAt) 
						: authData.expiresAt;
					
					if (expiresAt < new Date()) {
						throw new Error("Unauthorized: Authentication token has expired");
					}
				}

				// Run custom authorization logic
				if (authorize) {
					const authorized = await authorize(authData, context);
					if (!authorized) {
						throw new Error("Unauthorized: Custom authorization check failed");
					}
				}

				// Enrich context with userId for convenience
				if (authData[userIdKey]) {
					context = {
						...context,
						metadata: {
							...context.metadata,
							[USER_ID_METADATA_KEY]: authData[userIdKey],
						},
					};
				}
			}

			// Execute handler with validated auth context
			return handler(input, context);
		};
	};
}

/**
 * Create a role-based auth policy
 */
export function withRole(roles: string | string[], options: Omit<AuthPolicyOptions, "requiredRoles"> = {}): Policy {
	return withAuth({
		...options,
		requiredRoles: Array.isArray(roles) ? roles : [roles],
	});
}

/**
 * Create a permission-based auth policy
 */
export function withPermission(
	permissions: string | string[],
	options: Omit<AuthPolicyOptions, "requiredPermissions"> = {}
): Policy {
	return withAuth({
		...options,
		requiredPermissions: Array.isArray(permissions) ? permissions : [permissions],
	});
}

/**
 * Require authentication but allow any authenticated user
 */
export function withAuthRequired(options: Omit<AuthPolicyOptions, "allowAnonymous"> = {}): Policy {
	return withAuth({
		...options,
		allowAnonymous: false,
	});
}
