/**
 * Example: Type-safe Registry Usage
 * 
 * This example demonstrates how to use the type-safe registry
 * with module augmentation for compile-time type checking
 */

import { z } from "zod";
import {
	createTypedRegistry,
	executeTyped,
	type Procedure,
	type ExecutionContext,
	type BaseMetadata,
} from "@c4c/core";

// Define schemas
const addInputSchema = z.object({
	a: z.number(),
	b: z.number(),
});

const addOutputSchema = z.object({
	result: z.number(),
});

const userInputSchema = z.object({
	name: z.string(),
	email: z.string().email(),
});

const userOutputSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	createdAt: z.date(),
});

// Infer types
type AddInput = z.infer<typeof addInputSchema>;
type AddOutput = z.infer<typeof addOutputSchema>;
type UserInput = z.infer<typeof userInputSchema>;
type UserOutput = z.infer<typeof userOutputSchema>;

// Define procedures
const addProcedure: Procedure<AddInput, AddOutput> = {
	contract: {
		name: "math.add",
		input: addInputSchema,
		output: addOutputSchema,
	},
	handler: async ({ a, b }) => {
		return { result: a + b };
	},
};

// Define metadata type for authenticated context
interface AuthenticatedMetadata extends BaseMetadata {
	auth: {
		userId: string;
		roles: string[];
	};
	userId: string;
}

const createUserProcedure: Procedure<UserInput, UserOutput, ExecutionContext<AuthenticatedMetadata>> = {
	contract: {
		name: "users.create",
		input: userInputSchema,
		output: userOutputSchema,
		metadata: {
			exposure: "external",
			roles: ["api-endpoint"],
			auth: {
				requiresAuth: true,
				requiredRoles: ["admin"],
			},
		},
	},
	handler: async ({ name, email }, context) => {
		// Context is fully typed!
		const userId = context.metadata.auth.userId; // ✅ Type-safe
		const hasAdminRole = context.metadata.auth.roles.includes("admin"); // ✅ Type-safe

		return {
			id: `user_${Date.now()}`,
			name,
			email,
			createdAt: new Date(),
		};
	},
};

// Module augmentation for type-safe registry
declare module "@c4c/core" {
	interface ProcedureTypeMap {
		"math.add": typeof addProcedure;
		"users.create": typeof createUserProcedure;
	}
}

// Usage example
async function example() {
	// Create typed registry
	const registry = createTypedRegistry();

	// Register procedures
	registry.set("math.add", addProcedure);
	registry.set("users.create", createUserProcedure);

	// ✅ Type-safe execution with full type inference
	const addResult = await executeTyped(
		registry,
		"math.add",
		{ a: 5, b: 3 } // ✅ Input type is inferred
	);
	console.log(addResult.result); // ✅ Output type is inferred: number

	// ✅ Context type is also inferred for authenticated procedures
	const userResult = await executeTyped(
		registry,
		"users.create",
		{ name: "John Doe", email: "john@example.com" },
		{
			requestId: "req_123",
			timestamp: new Date(),
			metadata: {
				auth: {
					userId: "admin_1",
					roles: ["admin"],
				},
				userId: "admin_1",
			},
		}
	);
	console.log(userResult.id); // ✅ Output type is inferred: string

	// ❌ TypeScript error: Type mismatch
	// await executeTyped(registry, "math.add", { a: "not a number", b: 3 });

	// ❌ TypeScript error: Unknown procedure
	// await executeTyped(registry, "unknown.procedure", {});

	// ✅ Get procedure with preserved types
	const proc = registry.get("math.add");
	if (proc) {
		// proc is typed as Procedure<AddInput, AddOutput>
		const result = await proc.handler({ a: 10, b: 20 }, {
			requestId: "req_456",
			timestamp: new Date(),
			metadata: {},
		});
		console.log(result.result); // Type-safe: number
	}
}

// Run example
if (require.main === module) {
	example().catch(console.error);
}

export { example };
