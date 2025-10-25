/**
 * Example: Type-safe Policies with Context Transformation
 * 
 * This example shows how to create policies that transform context types
 */

import { z } from "zod";
import {
	type Procedure,
	type ExecutionContext,
	type BaseMetadata,
	type Policy,
	applyPolicies,
	createExecutionContext,
} from "@c4c/core";

// Define metadata types
interface AnonymousMetadata extends BaseMetadata {
	anonymous: true;
}

interface AuthenticatedMetadata extends BaseMetadata {
	auth: {
		userId: string;
		username: string;
		roles: string[];
	};
	userId: string;
}

interface OAuthMetadata extends AuthenticatedMetadata {
	oauth: {
		accessToken: string;
		refreshToken: string;
		provider: string;
		expiresAt: Date;
	};
}

// Type-safe policy that adds authentication
const withAuth: Policy<
	ExecutionContext<AnonymousMetadata>,
	ExecutionContext<AuthenticatedMetadata>
> = (handler) => {
	return async (input, context) => {
		// Extract auth from headers or token
		const authData = {
			userId: "user_123",
			username: "john.doe",
			roles: ["user"],
		};

		// Transform context to include auth
		const authenticatedContext: ExecutionContext<AuthenticatedMetadata> = {
			...context,
			metadata: {
				...context.metadata,
				auth: authData,
				userId: authData.userId,
			},
		};

		return handler(input, authenticatedContext);
	};
};

// Type-safe policy that adds OAuth
const withOAuth: Policy<
	ExecutionContext<AuthenticatedMetadata>,
	ExecutionContext<OAuthMetadata>
> = (handler) => {
	return async (input, context) => {
		// Fetch OAuth token
		const oauthData = {
			accessToken: "token_abc123",
			refreshToken: "refresh_xyz789",
			provider: "google",
			expiresAt: new Date(Date.now() + 3600000),
		};

		// Transform context to include OAuth
		const oauthContext: ExecutionContext<OAuthMetadata> = {
			...context,
			metadata: {
				...context.metadata,
				oauth: oauthData,
			},
		};

		return handler(input, oauthContext);
	};
};

// Type-safe policy for logging (doesn't transform context)
const withLogging: Policy = (handler) => {
	return async (input, context) => {
		console.log(`[${context.requestId}] Executing procedure at ${context.timestamp}`);
		const result = await handler(input, context);
		console.log(`[${context.requestId}] Completed successfully`);
		return result;
	};
};

// Example procedure that requires OAuth
const sendGoogleEmailSchema = z.object({
	to: z.string().email(),
	subject: z.string(),
	body: z.string(),
});

const emailResultSchema = z.object({
	sent: z.boolean(),
	messageId: z.string(),
});

type SendGoogleEmailInput = z.infer<typeof sendGoogleEmailSchema>;
type EmailResult = z.infer<typeof emailResultSchema>;

// Handler that uses OAuth context
const sendGoogleEmailHandler = async (
	input: SendGoogleEmailInput,
	context: ExecutionContext<OAuthMetadata>
): Promise<EmailResult> => {
	// ✅ Type-safe access to OAuth data
	const accessToken = context.metadata.oauth.accessToken;
	const userId = context.metadata.auth.userId;

	console.log(`Sending email using Google OAuth token for user ${userId}`);
	console.log(`Token: ${accessToken.substring(0, 10)}...`);

	// Simulate sending email
	return {
		sent: true,
		messageId: `msg_${Date.now()}`,
	};
};

// Compose policies with proper type transformations
const protectedHandler = applyPolicies(
	sendGoogleEmailHandler,
	withOAuth, // Adds OAuth to authenticated context
	withAuth, // Adds auth to anonymous context
	withLogging // Doesn't transform context
);

// Create procedure with all policies
const sendGoogleEmailProcedure: Procedure<
	SendGoogleEmailInput,
	EmailResult,
	ExecutionContext<AnonymousMetadata>
> = {
	contract: {
		name: "google.email.send",
		input: sendGoogleEmailSchema,
		output: emailResultSchema,
		metadata: {
			exposure: "external",
			roles: ["api-endpoint"],
			auth: {
				requiresAuth: true,
			},
		},
	},
	handler: protectedHandler,
};

// Usage example
async function example() {
	// Create anonymous context (no auth data)
	const anonymousContext = createExecutionContext<AnonymousMetadata>({
		anonymous: true,
	});

	// Execute procedure - policies will add auth and OAuth
	const result = await sendGoogleEmailProcedure.handler(
		{
			to: "recipient@example.com",
			subject: "Hello",
			body: "Test email",
		},
		anonymousContext
	);

	console.log("Email sent:", result);

	// ✅ Type safety: Can't access oauth on anonymous context
	// anonymousContext.metadata.oauth; // ❌ TypeScript error

	// ✅ But inside the handler, context is transformed and has OAuth
}

// Export for testing
export {
	withAuth,
	withOAuth,
	withLogging,
	sendGoogleEmailProcedure,
	example,
};

// Run example
if (require.main === module) {
	example().catch(console.error);
}
