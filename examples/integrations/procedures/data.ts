import { z } from "zod";
import { applyPolicies, type Procedure } from "@c4c/core";
import { withAuthRequired } from "@c4c/policies";

const fetchInput = z.object({
	userId: z.string(),
});

const fetchOutput = z.object({
	userId: z.string(),
	isPremium: z.boolean(),
	tier: z.enum(["basic", "premium", "enterprise"]),
	fetchedAt: z.string(),
});

export const dataFetch: Procedure<z.infer<typeof fetchInput>, z.infer<typeof fetchOutput>> = {
	contract: {
		name: "data.fetch",
		description: "Fetches user metadata for demos.",
		input: fetchInput,
		output: fetchOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "demo",
			tags: ["data"],
		},
	},
	handler: async ({ userId }) => {
		const now = new Date().toISOString();
		const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
		const tiers = ["basic", "premium", "enterprise"] as const;
		const tier = tiers[hash % tiers.length];
		return {
			userId,
			isPremium: tier !== "basic",
			tier,
			fetchedAt: now,
		};
	},
};

const processInput = z.object({
	mode: z.enum(["basic", "premium", "enterprise"]),
	payload: z.record(z.string(), z.unknown()).optional(),
});

const processOutput = z.object({
	status: z.enum(["processed", "skipped"]),
	mode: z.enum(["basic", "premium", "enterprise"]),
	processedAt: z.string(),
});

export const dataProcess: Procedure<z.infer<typeof processInput>, z.infer<typeof processOutput>> = {
	contract: {
		name: "data.process",
		description: "Processes data according to the selected mode.",
		input: processInput,
		output: processOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "demo",
			tags: ["data"],
		},
	},
	handler: async ({ mode }) => ({
		status: "processed",
		mode,
		processedAt: new Date().toISOString(),
	}),
};

const saveInput = z.object({
	payload: z.unknown().optional(),
});

const saveOutput = z.object({
	stored: z.boolean(),
	storedAt: z.string(),
});

export const dataSave: Procedure<z.infer<typeof saveInput>, z.infer<typeof saveOutput>> = {
	contract: {
		name: "data.save",
		description: "Persists data for demo workflows.",
		input: saveInput,
		output: saveOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "demo",
			tags: ["data"],
		},
	},
	handler: async () => ({
		stored: true,
		storedAt: new Date().toISOString(),
	}),
};

const secureActionInput = z.object({
	moderatorId: z.string(),
	targetUserId: z.string(),
	action: z.enum(["promote", "suspend", "deactivate"]),
	notes: z.string().optional(),
});

const secureActionOutput = z.object({
	action: z.enum(["promote", "suspend", "deactivate"]),
	moderatorId: z.string(),
	targetUserId: z.string(),
	actorRole: z.enum(["moderator", "admin"]),
	performedAt: z.string(),
	notes: z.string().optional(),
});

export const dataSecureAction: Procedure<
	z.infer<typeof secureActionInput>,
	z.infer<typeof secureActionOutput>
> = {
	contract: {
		name: "data.secureAction",
		description: "Performs a privileged moderation action that requires authentication.",
		input: secureActionInput,
		output: secureActionOutput,
		metadata: {
			exposure: "external",
			roles: ["workflow-node", "api-endpoint"],
			category: "demo",
			tags: ["data", "auth"],
			auth: {
				requiresAuth: true,
				requiredRoles: ["moderator"],
				authScheme: "Bearer",
			},
		},
	},
	handler: applyPolicies(
		async ({ action, moderatorId, targetUserId, notes }, context) => {
			const auth = context.metadata.auth as { token?: string } | undefined;
			const tokenRoleMap: Record<string, "moderator" | "admin"> = {
				"demo-moderator-token": "moderator",
				"demo-admin-token": "admin",
			};

			const role = auth?.token ? tokenRoleMap[auth.token] : undefined;
			if (!role) {
				throw new Error("Unauthorized: invalid or missing moderator token");
			}

			return {
				action,
				moderatorId,
				targetUserId,
				actorRole: role,
				performedAt: new Date().toISOString(),
				notes,
			};
		},
		withAuthRequired({
			requiredFields: ["token"],
			unauthorizedMessage: "Unauthorized: bearer token required for secure action",
		})
	),
};
