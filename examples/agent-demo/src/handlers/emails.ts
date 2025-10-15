import type { Procedure } from "@tsdev/core";
import { sendWelcomeEmailContract } from "../contracts/emails.js";

export const sendWelcomeEmail: Procedure = {
	contract: sendWelcomeEmailContract,
	handler: async (input) => {
		// Simulate email sending with delay
		await new Promise((resolve) => setTimeout(resolve, 500));

		const messageId = `msg_${Date.now()}`;

		console.log(`[emails.sendWelcome] Sent email to ${input.email} (${input.name})`);

		return {
			messageId,
			status: "sent" as const,
			sentAt: new Date().toISOString(),
		};
	},
};
