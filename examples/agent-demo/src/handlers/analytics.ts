import type { Procedure } from "@tsdev/core";
import { trackEventContract } from "../contracts/analytics.js";

export const trackEvent: Procedure = {
	contract: trackEventContract,
	handler: async (input) => {
		const eventId = `evt_${Date.now()}`;

		console.log(`[analytics.track] Tracked event: ${input.event}`, {
			userId: input.userId,
			properties: input.properties,
		});

		return {
			tracked: true,
			eventId,
			timestamp: new Date().toISOString(),
		};
	},
};
