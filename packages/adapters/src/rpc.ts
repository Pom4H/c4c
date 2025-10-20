import { Hono } from "hono";
import { createExecutionContext, executeProcedure, isProcedureVisible, type Registry } from "@c4c/core";
import type { Context } from "hono";

/**
 * Helper to extract auth data from HTTP request headers
 * This is used to populate the execution context with authentication data
 * that can be validated by the withAuth policy.
 * 
 * Example usage:
 * ```typescript
 * const authData = extractAuthFromHeaders(c);
 * const context = createExecutionContext({ auth: authData });
 * ```
 */
export function extractAuthFromHeaders(c: Context): Record<string, unknown> | null {
	const authHeader = c.req.header("authorization");
	
	if (!authHeader) {
		return null;
	}

	// Parse Bearer token
	if (authHeader.startsWith("Bearer ")) {
		const token = authHeader.substring(7);
		
		// In a real application, you would:
		// 1. Verify the JWT token
		// 2. Extract claims from the token
		// 3. Return structured auth data
		//
		// For example with JWT:
		// const decoded = jwt.verify(token, secret);
		// return {
		//   userId: decoded.sub,
		//   username: decoded.username,
		//   email: decoded.email,
		//   roles: decoded.roles,
		//   permissions: decoded.permissions,
		//   token: token,
		//   expiresAt: new Date(decoded.exp * 1000),
		// };
		
		return {
			token,
			// Add decoded token data here in production
		};
	}

	// Parse Basic auth
	if (authHeader.startsWith("Basic ")) {
		const encoded = authHeader.substring(6);
		const decoded = Buffer.from(encoded, "base64").toString("utf-8");
		const [username, password] = decoded.split(":");
		
		// In production, validate credentials against database
		// and return user data
		
		return {
			username,
			// Don't return password - validate and return user data instead
		};
	}

	// Parse API Key
	const apiKey = c.req.header("x-api-key");
	if (apiKey) {
		// In production, look up API key in database
		// and return associated user/application data
		
		return {
			apiKey,
			// Add user/app data here
		};
	}

	return null;
}

export function createRpcRouter(registry: Registry) {
	const router = new Hono();

	router.post("/rpc/:procedureName", async (c) => {
		const procedureName = c.req.param("procedureName");

		const procedure = registry.get(procedureName);
		if (!procedure || !isProcedureVisible(procedure.contract, "rpc")) {
			return c.json({ error: `Procedure '${procedureName}' not found` }, 404);
		}

		try {
			const input = await c.req.json<Record<string, unknown>>();

			// Extract auth data from headers
			const authData = extractAuthFromHeaders(c);

			const context = createExecutionContext({
				transport: "http",
				method: c.req.method,
				url: c.req.path,
				userAgent: c.req.header("user-agent"),
				// Add auth data to context metadata if present
				// This is what the withAuth policy expects
				...(authData && { auth: authData }),
			});

			const result = await executeProcedure(procedure, input, context);
			return c.json(result, 200);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			// Check for auth errors
			const isUnauthorized = message.includes("Unauthorized") || message.includes("Forbidden");
			const statusCode = isUnauthorized ? 401 : message.includes("not found") ? 404 : 400;
			return c.json({ error: message }, statusCode);
		}
	});

	return router;
}
