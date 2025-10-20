/**
 * @c4c/policies - Composable policies
 * 
 * Retry, logging, tracing, rate limiting, authentication, and authorization policies
 */

export { withLogging } from "./withLogging.js";
export { withRetry } from "./withRetry.js";
export { withRateLimit } from "./withRateLimit.js";
export { withSpan } from "./withSpan.js";
export { withOAuth, getOAuthHeaders, getOAuthToken } from "./withOAuth.js";
export { 
	withAuth, 
	withRole, 
	withPermission, 
	withAuthRequired,
	getAuthData,
	getUserId,
	hasRole,
	hasPermission,
	hasAnyRole,
	hasAllRoles,
	requireAuth,
	createAuthProcedure,
	type AuthPolicyOptions,
	type AuthData,
	type AuthScheme,
} from "./withAuth.js";
