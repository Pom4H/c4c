/**
 * Example: Type-safe Workflow with Validation
 * 
 * This example demonstrates compile-time type checking for workflows
 */

import { z } from "zod";
import {
	workflow,
	step,
	condition,
	parallel,
	validateWorkflowTypes,
	type WorkflowDefinition,
} from "@c4c/workflow";
import type { Procedure } from "@c4c/core";

// Define strongly-typed procedures
const getUserSchema = z.object({ userId: z.string() });
const userSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	credits: z.number(),
});

const sendEmailSchema = z.object({
	to: z.string(),
	subject: z.string(),
	body: z.string(),
});
const emailResultSchema = z.object({ sent: z.boolean(), messageId: z.string() });

const deductCreditsSchema = z.object({ userId: z.string(), amount: z.number() });
const creditsResultSchema = z.object({ success: z.boolean(), remaining: z.number() });

// Define procedures
const getUserProcedure: Procedure<
	z.infer<typeof getUserSchema>,
	z.infer<typeof userSchema>
> = {
	contract: {
		name: "users.get",
		input: getUserSchema,
		output: userSchema,
	},
	handler: async ({ userId }) => ({
		id: userId,
		name: "John Doe",
		email: "john@example.com",
		credits: 100,
	}),
};

const sendEmailProcedure: Procedure<
	z.infer<typeof sendEmailSchema>,
	z.infer<typeof emailResultSchema>
> = {
	contract: {
		name: "email.send",
		input: sendEmailSchema,
		output: emailResultSchema,
	},
	handler: async ({ to, subject, body }) => ({
		sent: true,
		messageId: `msg_${Date.now()}`,
	}),
};

const deductCreditsProcedure: Procedure<
	z.infer<typeof deductCreditsSchema>,
	z.infer<typeof creditsResultSchema>
> = {
	contract: {
		name: "credits.deduct",
		input: deductCreditsSchema,
		output: creditsResultSchema,
	},
	handler: async ({ userId, amount }) => ({
		success: true,
		remaining: 95,
	}),
};

// Create type-safe workflow
function createTypeSafeWorkflow(): WorkflowDefinition {
	// Step 1: Get user
	const getUserStep = step({
		id: "getUser",
		procedure: "users.get",
		input: getUserSchema,
		output: userSchema,
	});

	// Step 2: Check if user has credits (condition)
	const checkCreditsCondition = condition({
		id: "checkCredits",
		input: userSchema,
		whenTrue: step({
			id: "sendEmail",
			procedure: "email.send",
			input: sendEmailSchema,
			output: emailResultSchema,
		}),
		whenFalse: step({
			id: "logError",
			procedure: "logger.error",
			input: z.object({ message: z.string() }),
			output: z.object({ logged: z.boolean() }),
		}),
		predicate: (ctx) => {
			const user = ctx.inputData as z.infer<typeof userSchema>;
			return user.credits > 0;
		},
	});

	// Step 3: Deduct credits in parallel with sending notification
	const parallelStep = parallel({
		id: "parallelActions",
		branches: [
			step({
				id: "deductCredits",
				procedure: "credits.deduct",
				input: deductCreditsSchema,
				output: creditsResultSchema,
			}),
			step({
				id: "sendNotification",
				procedure: "notifications.send",
				input: z.object({ userId: z.string(), message: z.string() }),
				output: z.object({ sent: z.boolean() }),
			}),
		],
		output: z.object({
			credits: creditsResultSchema,
			notification: z.object({ sent: z.boolean() }),
		}),
		waitForAll: true,
	});

	// Build workflow
	return workflow("sendEmailWorkflow")
		.name("Send Email Workflow")
		.description("Send email to user if they have credits")
		.version("1.0.0")
		.input(getUserSchema)
		.step(getUserStep)
		.step(checkCreditsCondition)
		.step(parallelStep)
		.commit();
}

// Validate workflow at runtime
async function validateWorkflowExample() {
	const workflowDef = createTypeSafeWorkflow();

	// Create procedure registry
	const procedureRegistry = new Map([
		["users.get", getUserProcedure],
		["email.send", sendEmailProcedure],
		["credits.deduct", deductCreditsProcedure],
	]);

	// Validate workflow types
	const validation = validateWorkflowTypes(workflowDef, procedureRegistry);

	if (validation.valid) {
		console.log("✅ Workflow is type-safe!");
	} else {
		console.error("❌ Workflow has type errors:");
		for (const error of validation.errors) {
			console.error(`  - Node ${error.nodeId}: ${error.error}`);
		}
	}

	return { workflowDef, validation };
}

// Export for testing
export { createTypeSafeWorkflow, validateWorkflowExample };

// Run example
if (require.main === module) {
	validateWorkflowExample().catch(console.error);
}
