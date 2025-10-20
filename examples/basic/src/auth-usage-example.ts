/**
 * Example demonstrating how to use the auth policy with procedures
 * 
 * The auth policy expects authentication data to be passed in the execution context metadata.
 * This is typically set by the adapter (HTTP, RPC, etc.) when processing incoming requests.
 */

import { createExecutionContext, executeProcedure } from "@c4c/core";
import { getUserProfile, updateUserProfile, deleteUser, listUsers } from "./handlers/auth-example.js";

// ============================================================================
// Helper to create auth context
// ============================================================================

function createAuthContext(authData: {
	userId: string;
	username?: string;
	email?: string;
	roles?: string[];
	permissions?: string[];
	token?: string;
	expiresAt?: Date | string;
}) {
	const context = createExecutionContext();
	
	// Set auth data in metadata - this is what the withAuth policy expects
	context.metadata.auth = authData;
	
	return context;
}

// ============================================================================
// Example 1: Authenticated user accessing their own profile
// ============================================================================

async function example1() {
	console.log("\n=== Example 1: Get own user profile ===");
	
	const context = createAuthContext({
		userId: "user_123",
		username: "john_doe",
		email: "john@example.com",
		roles: ["user"],
		token: "jwt-token-here",
	});

	try {
		const result = await executeProcedure(
			getUserProfile,
			{ userId: "user_123" },
			context
		);
		console.log("✓ Success:", result);
	} catch (error) {
		console.error("✗ Error:", (error as Error).message);
	}
}

// ============================================================================
// Example 2: User trying to access another user's profile (should fail)
// ============================================================================

async function example2() {
	console.log("\n=== Example 2: User trying to access another user's profile ===");
	
	const context = createAuthContext({
		userId: "user_123",
		username: "john_doe",
		email: "john@example.com",
		roles: ["user"],
	});

	try {
		const result = await executeProcedure(
			getUserProfile,
			{ userId: "user_456" }, // Trying to access different user
			context
		);
		console.log("✓ Success:", result);
	} catch (error) {
		console.error("✗ Expected error:", (error as Error).message);
	}
}

// ============================================================================
// Example 3: Admin accessing another user's profile (should succeed)
// ============================================================================

async function example3() {
	console.log("\n=== Example 3: Admin accessing another user's profile ===");
	
	const context = createAuthContext({
		userId: "user_456",
		username: "jane_admin",
		email: "jane@example.com",
		roles: ["user", "admin"],
	});

	try {
		const result = await executeProcedure(
			getUserProfile,
			{ userId: "user_123" }, // Admin accessing different user
			context
		);
		console.log("✓ Success:", result);
	} catch (error) {
		console.error("✗ Error:", (error as Error).message);
	}
}

// ============================================================================
// Example 4: Unauthenticated request (should fail)
// ============================================================================

async function example4() {
	console.log("\n=== Example 4: Unauthenticated request ===");
	
	const context = createExecutionContext();
	// No auth data set in metadata

	try {
		const result = await executeProcedure(
			getUserProfile,
			{ userId: "user_123" },
			context
		);
		console.log("✓ Success:", result);
	} catch (error) {
		console.error("✗ Expected error:", (error as Error).message);
	}
}

// ============================================================================
// Example 5: Update profile with permissions
// ============================================================================

async function example5() {
	console.log("\n=== Example 5: Update profile with required permissions ===");
	
	const context = createAuthContext({
		userId: "user_123",
		username: "john_doe",
		email: "john@example.com",
		roles: ["user"],
		permissions: ["write:users"], // Has required permission
	});

	try {
		const result = await executeProcedure(
			updateUserProfile,
			{ 
				userId: "user_123",
				username: "john_updated",
			},
			context
		);
		console.log("✓ Success:", result);
	} catch (error) {
		console.error("✗ Error:", (error as Error).message);
	}
}

// ============================================================================
// Example 6: Update profile without permissions (should fail)
// ============================================================================

async function example6() {
	console.log("\n=== Example 6: Update profile without required permissions ===");
	
	const context = createAuthContext({
		userId: "user_123",
		username: "john_doe",
		email: "john@example.com",
		roles: ["user"],
		// No permissions set
	});

	try {
		const result = await executeProcedure(
			updateUserProfile,
			{ 
				userId: "user_123",
				username: "john_updated",
			},
			context
		);
		console.log("✓ Success:", result);
	} catch (error) {
		console.error("✗ Expected error:", (error as Error).message);
	}
}

// ============================================================================
// Example 7: Delete user with admin role
// ============================================================================

async function example7() {
	console.log("\n=== Example 7: Delete user with admin role ===");
	
	const context = createAuthContext({
		userId: "user_456",
		username: "jane_admin",
		email: "jane@example.com",
		roles: ["user", "admin"], // Has required admin role
	});

	try {
		const result = await executeProcedure(
			deleteUser,
			{ userId: "user_999" },
			context
		);
		console.log("✓ Success:", result);
	} catch (error) {
		console.error("✗ Error:", (error as Error).message);
	}
}

// ============================================================================
// Example 8: Delete user without admin role (should fail)
// ============================================================================

async function example8() {
	console.log("\n=== Example 8: Delete user without admin role ===");
	
	const context = createAuthContext({
		userId: "user_123",
		username: "john_doe",
		email: "john@example.com",
		roles: ["user"], // No admin role
	});

	try {
		const result = await executeProcedure(
			deleteUser,
			{ userId: "user_999" },
			context
		);
		console.log("✓ Success:", result);
	} catch (error) {
		console.error("✗ Expected error:", (error as Error).message);
	}
}

// ============================================================================
// Example 9: List users with moderator role
// ============================================================================

async function example9() {
	console.log("\n=== Example 9: List users with moderator role ===");
	
	const context = createAuthContext({
		userId: "user_789",
		username: "moderator_user",
		email: "mod@example.com",
		roles: ["user", "moderator"], // Has moderator role
	});

	try {
		const result = await executeProcedure(
			listUsers,
			{ limit: 5, offset: 0 },
			context
		);
		console.log("✓ Success:", result);
	} catch (error) {
		console.error("✗ Error:", (error as Error).message);
	}
}

// ============================================================================
// Example 10: Token expiration check
// ============================================================================

async function example10() {
	console.log("\n=== Example 10: Expired token ===");
	
	const context = createAuthContext({
		userId: "user_123",
		username: "john_doe",
		email: "john@example.com",
		roles: ["user"],
		token: "expired-token",
		expiresAt: new Date("2020-01-01"), // Expired date
	});

	try {
		const result = await executeProcedure(
			getUserProfile,
			{ userId: "user_123" },
			context
		);
		console.log("✓ Success:", result);
	} catch (error) {
		console.error("✗ Expected error:", (error as Error).message);
	}
}

// ============================================================================
// Run all examples
// ============================================================================

async function runAllExamples() {
	await example1();
	await example2();
	await example3();
	await example4();
	await example5();
	await example6();
	await example7();
	await example8();
	await example9();
	await example10();
	
	console.log("\n=== All examples completed ===\n");
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runAllExamples().catch(console.error);
}

export { runAllExamples };
