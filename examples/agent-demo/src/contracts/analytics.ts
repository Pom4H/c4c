import { z } from "zod";
import type { Contract } from "@tsdev/core";

export const trackEventContract: Contract = {
	name: "analytics.track",
	description: "Track analytics event",
	input: z.object({
		event: z.string().describe("Event name"),
		userId: z.string().optional().describe("User ID"),
		properties: z.record(z.unknown()).optional().describe("Event properties"),
	}),
	output: z.object({
		tracked: z.boolean(),
		eventId: z.string(),
		timestamp: z.string().datetime(),
	}),
	metadata: {
		tags: ["analytics", "tracking"],
	},
};
