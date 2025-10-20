import type { Procedure } from "@c4c/core";
import { applyPolicies } from "@c4c/core";
import { withAuth, withRole, withPermission, withAuthRequired, requireAuth, createAuthProcedure } from "@c4c/policies";
import { z } from "zod";

// ============================================================================
// Contracts
// ============================================================================

// Contract with auth metadata for client generation
const getUserProfileContract = requireAuth({
	name: "getUserProfile",
	description: "Get user profile - requires authentication",
	input: z.object({
		userId: z.string(),
	}),
	output: z.object({
		userId: z.string(),
		username: z.string(),
		email: z.string(),
		roles: z.array(z.string()),
	}),
	metadata: {
		exposure: "external",
		roles: ["api-endpoint", "sdk-client"],
	},
});

const updateUserProfileContract = {
	name: "updateUserProfile",
	description: "Update user profile - requires authentication and specific permissions",
	input: z.object({
		userId: z.string(),
		username: z.string().optional(),
		email: z.string().email().optional(),
	}),
	output: z.object({
		userId: z.string(),
		username: z.string(),
		email: z.string(),
		updatedAt: z.string(),
	}),
};

const deleteUserContract = requireAuth({
	name: "deleteUser",
	description: "Delete user - requires admin role",
	input: z.object({
		userId: z.string(),
	}),
	output: z.object({
		success: z.boolean(),
		message: z.string(),
	}),
	metadata: {
		exposure: "external",
		roles: ["api-endpoint", "sdk-client"],
	},
}, {
	requiredRoles: ["admin"],
});

const listUsersContract = requireAuth({
	name: "listUsers",
	description: "List all users - requires moderator or admin role",
	input: z.object({
		limit: z.number().optional().default(10),
		offset: z.number().optional().default(0),
	}),
	output: z.object({
		users: z.array(z.object({
			userId: z.string(),
			username: z.string(),
			email: z.string(),
		})),
		total: z.number(),
	}),
	metadata: {
		exposure: "external",
		roles: ["api-endpoint", "sdk-client"],
	},
}, {
	requiredRoles: ["moderator", "admin"],
});

// ============================================================================
// In-memory storage for demo
// ============================================================================

const userProfiles = new Map<string, {
	userId: string;
	username: string;
	email: string;
	roles: string[];
}>();

// Initialize with some sample data
userProfiles.set("user_123", {
	userId: "user_123",
	username: "john_doe",
	email: "john@example.com",
	roles: ["user"],
});

userProfiles.set("user_456", {
	userId: "user_456",
	username: "jane_admin",
	email: "jane@example.com",
	roles: ["user", "admin"],
});

// ============================================================================
// Procedure 1: Get User Profile - Requires authentication only
// ============================================================================

export const getUserProfile: Procedure = {
	contract: getUserProfileContract,
	handler: applyPolicies(
		async (input, context) => {
			// The auth policy ensures context.metadata.auth exists
			// and context.metadata.userId is set
			const requestingUserId = context.metadata.userId as string;
			
			// Only allow users to get their own profile unless they're admin
			if (input.userId !== requestingUserId) {
				const authData = context.metadata.auth as { roles?: string[] };
				if (!authData?.roles?.includes("admin")) {
					throw new Error("Forbidden: You can only access your own profile");
				}
			}

			const profile = userProfiles.get(input.userId);
			if (!profile) {
				throw new Error(`User profile not found for userId: ${input.userId}`);
			}

			return profile;
		},
		// Apply auth policy - requires authentication
		withAuthRequired({
			requiredFields: ["userId"],
		})
	),
};

// ============================================================================
// Procedure 2: Update User Profile - Requires specific permissions
// ============================================================================

export const updateUserProfile: Procedure = {
	contract: updateUserProfileContract,
	handler: applyPolicies(
		async (input, context) => {
			const requestingUserId = context.metadata.userId as string;
			
			// Only allow users to update their own profile unless they have admin permission
			if (input.userId !== requestingUserId) {
				const authData = context.metadata.auth as { permissions?: string[] };
				if (!authData?.permissions?.includes("write:any_user")) {
					throw new Error("Forbidden: You can only update your own profile");
				}
			}

			const profile = userProfiles.get(input.userId);
			if (!profile) {
				throw new Error(`User profile not found for userId: ${input.userId}`);
			}

			// Update profile
			const updatedProfile = {
				...profile,
				username: input.username ?? profile.username,
				email: input.email ?? profile.email,
			};

			userProfiles.set(input.userId, updatedProfile);

			return {
				...updatedProfile,
				updatedAt: new Date().toISOString(),
			};
		},
		// Requires authentication and specific permission
		withPermission("write:users", {
			requiredFields: ["userId"],
		})
	),
};

// ============================================================================
// Procedure 3: Delete User - Requires admin role
// ============================================================================

export const deleteUser: Procedure = {
	contract: deleteUserContract,
	handler: applyPolicies(
		async (input) => {
			const deleted = userProfiles.delete(input.userId);
			
			return {
				success: deleted,
				message: deleted 
					? `User ${input.userId} deleted successfully`
					: `User ${input.userId} not found`,
			};
		},
		// Requires admin role
		withRole("admin")
	),
};

// ============================================================================
// Procedure 4: List Users - Requires moderator or admin role
// ============================================================================

export const listUsers: Procedure = {
	contract: listUsersContract,
	handler: applyPolicies(
		async (input) => {
			const allUsers = Array.from(userProfiles.values());
			const start = input.offset || 0;
			const end = start + (input.limit || 10);
			const paginatedUsers = allUsers.slice(start, end);

			return {
				users: paginatedUsers.map(({ userId, username, email }) => ({
					userId,
					username,
					email,
				})),
				total: allUsers.length,
			};
		},
		// Requires either moderator or admin role
		withRole(["moderator", "admin"])
	),
};

// ============================================================================
// Procedure 5: Custom authorization logic
// ============================================================================

const customAuthContract = {
	name: "customAuthExample",
	description: "Example with custom authorization logic",
	input: z.object({
		resourceId: z.string(),
	}),
	output: z.object({
		allowed: z.boolean(),
	}),
};

export const customAuthExample: Procedure = {
	contract: customAuthContract,
	handler: applyPolicies(
		async (input) => {
			// Custom logic here
			return { allowed: true };
		},
		// Custom authorization function
		withAuth({
			authorize: async (authData, context) => {
				// Custom logic: check if user has access to this specific resource
				// For example, check ownership, time-based access, etc.
				const userId = authData.userId;
				const isOwner = userId === "owner_of_resource";
				const hasAdminRole = authData.roles?.includes("admin") ?? false;
				
				return isOwner || hasAdminRole;
			},
		})
	),
};
		})
	),
};
