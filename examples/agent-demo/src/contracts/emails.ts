import { z } from "zod";
import type { Contract } from "@tsdev/core";

export const sendWelcomeEmailContract: Contract = {
	name: "emails.sendWelcome",
	description: "Send welcome email to new user",
	input: z.object({
		userId: z.string().describe("User ID"),
		email: z.string().email().describe("User's email"),
		name: z.string().describe("User's name"),
	}),
	output: z.object({
		messageId: z.string().describe("Email message ID"),
		status: z.enum(["sent", "failed"]),
		sentAt: z.string().datetime(),
	}),
	metadata: {
		tags: ["emails", "notifications"],
	},
};
