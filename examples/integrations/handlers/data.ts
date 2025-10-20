import { z } from "zod";
import type { Procedure } from "@c4c/core";

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
