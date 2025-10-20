/**
 * Simplified auth procedure examples using createAuthProcedure helper
 * 
 * This helper automatically:
 * 1. Adds auth metadata to the contract (for client generation)
 * 2. Applies the appropriate auth policy to the handler
 */

import { createAuthProcedure } from "@c4c/policies";
import { z } from "zod";

// ============================================================================
// Example 1: Simple authenticated procedure
// ============================================================================

export const getMyProfile = createAuthProcedure({
	contract: {
		name: "getMyProfile",
		description: "Get current user's profile",
		input: z.object({}),
		output: z.object({
			userId: z.string(),
			username: z.string(),
			email: z.string(),
		}),
		metadata: {
			exposure: "external",
			roles: ["api-endpoint", "sdk-client"],
		},
	},
	handler: async (input, context) => {
		const userId = context.metadata.userId as string;
		
		// Fetch user data
		return {
			userId,
			username: "john_doe",
			email: "john@example.com",
		};
	},
	auth: {
		// Just requires authentication, any authenticated user can access
	},
});

// ============================================================================
// Example 2: Role-based procedure
// ============================================================================

export const getAdminDashboard = createAuthProcedure({
	contract: {
		name: "getAdminDashboard",
		description: "Get admin dashboard data",
		input: z.object({
			period: z.enum(["day", "week", "month"]),
		}),
		output: z.object({
			totalUsers: z.number(),
			activeUsers: z.number(),
			revenue: z.number(),
		}),
		metadata: {
			exposure: "external",
			roles: ["api-endpoint", "sdk-client"],
		},
	},
	handler: async (input) => {
		// Only admins can access this
		return {
			totalUsers: 1000,
			activeUsers: 250,
			revenue: 50000,
		};
	},
	auth: {
		requiredRoles: ["admin"],
	},
});

// ============================================================================
// Example 3: Permission-based procedure
// ============================================================================

export const exportUserData = createAuthProcedure({
	contract: {
		name: "exportUserData",
		description: "Export user data (requires specific permission)",
		input: z.object({
			format: z.enum(["csv", "json", "xlsx"]),
			userIds: z.array(z.string()).optional(),
		}),
		output: z.object({
			downloadUrl: z.string(),
			expiresAt: z.string(),
		}),
		metadata: {
			exposure: "external",
			roles: ["api-endpoint", "sdk-client"],
		},
	},
	handler: async (input) => {
		// Generate export file
		const url = `https://example.com/exports/${Date.now()}.${input.format}`;
		const expiresAt = new Date(Date.now() + 3600000).toISOString();
		
		return {
			downloadUrl: url,
			expiresAt,
		};
	},
	auth: {
		requiredPermissions: ["export:users"],
	},
});

// ============================================================================
// Example 4: Multiple roles
// ============================================================================

export const moderateContent = createAuthProcedure({
	contract: {
		name: "moderateContent",
		description: "Moderate user-generated content",
		input: z.object({
			contentId: z.string(),
			action: z.enum(["approve", "reject", "flag"]),
			reason: z.string().optional(),
		}),
		output: z.object({
			success: z.boolean(),
			contentId: z.string(),
			status: z.string(),
		}),
		metadata: {
			exposure: "external",
			roles: ["api-endpoint", "sdk-client"],
		},
	},
	handler: async (input) => {
		// Perform moderation action
		return {
			success: true,
			contentId: input.contentId,
			status: input.action,
		};
	},
	auth: {
		// Either moderator or admin can access
		requiredRoles: ["moderator", "admin"],
	},
});

// ============================================================================
// Example 5: Custom authorization logic
// ============================================================================

export const updateSettings = createAuthProcedure({
	contract: {
		name: "updateSettings",
		description: "Update user settings",
		input: z.object({
			userId: z.string(),
			settings: z.record(z.unknown()),
		}),
		output: z.object({
			success: z.boolean(),
			updatedAt: z.string(),
		}),
		metadata: {
			exposure: "external",
			roles: ["api-endpoint", "sdk-client"],
		},
	},
	handler: async (input) => {
		// Update settings
		return {
			success: true,
			updatedAt: new Date().toISOString(),
		};
	},
	auth: {
		// Custom authorization: user can only update their own settings unless they're admin
		authorize: async (authData, context) => {
			const requestingUserId = authData.userId;
			const targetUserId = (context.metadata.input as any)?.userId;
			
			// Allow if updating own settings
			if (requestingUserId === targetUserId) {
				return true;
			}
			
			// Or if user is admin
			return authData.roles?.includes("admin") ?? false;
		},
	},
});

// ============================================================================
// When these procedures are used with the generated client:
// ============================================================================

/*
const client = createTsdevClient({
	baseUrl: "http://localhost:3000",
	authToken: "your-jwt-token",
});

// All these procedures will automatically include the Authorization header:
await client.procedures.getMyProfile({});
await client.procedures.getAdminDashboard({ period: "week" });
await client.procedures.exportUserData({ format: "csv" });
await client.procedures.moderateContent({ 
	contentId: "123", 
	action: "approve" 
});
await client.procedures.updateSettings({ 
	userId: "123", 
	settings: { theme: "dark" } 
});
*/
