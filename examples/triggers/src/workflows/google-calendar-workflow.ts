/**
 * Google Calendar Workflow
 *
 * Uses "use workflow" / "use step" directives from the Workflow DevKit.
 * All steps use the "use step" directive for automatic retry semantics.
 */

async function routeCalendarEvent(notification: unknown) {
	"use step";
	const data = notification as Record<string, unknown>;
	console.log("[route] Routing calendar event:", data);
	const resourceState = data?.resourceState as string;
	const eventType = resourceState === "exists" ? "created"
		: resourceState === "sync" ? "updated"
			: resourceState === "not_exists" ? "deleted"
				: "unknown";
	return {
		eventType,
		eventId: data?.resourceId as string,
		shouldFetchDetails: eventType !== "deleted",
	};
}

async function fetchEventDetails(calendarId: string, eventId: string) {
	"use step";
	console.log(`[fetch] Getting event ${eventId} from calendar ${calendarId}`);
	return {
		id: eventId,
		summary: "Team Meeting",
		start: { dateTime: new Date().toISOString() },
		end: { dateTime: new Date(Date.now() + 3600000).toISOString() },
	};
}

async function handleEventCreated(event: Record<string, unknown>) {
	"use step";
	console.log("[handle-created] New event:", event.summary);
	return { shouldNotify: true, message: `*New Calendar Event*\n${event.summary}` };
}

async function handleEventUpdated(event: Record<string, unknown>) {
	"use step";
	console.log("[handle-updated] Updated event:", event.summary);
	return { shouldNotify: true, message: `*Updated Calendar Event*\n${event.summary}` };
}

async function handleEventDeleted(eventId: string) {
	"use step";
	console.log("[handle-deleted] Deleted event:", eventId);
	return { shouldNotify: false };
}

async function sendTelegramNotification(chatId: string, text: string) {
	"use step";
	console.log(`[telegram] Sending to ${chatId}: ${text}`);
	return { ok: true, messageId: `msg_${Date.now()}` };
}

async function logCalendarEvent(level: string, message: string, data: unknown) {
	"use step";
	console.log(`[${level}] ${message}`, data);
}

/**
 * Google Calendar Event Sync Workflow
 */
export async function googleCalendarSync(notification: unknown) {
	"use workflow";

	const route = await routeCalendarEvent(notification);

	let eventDetails: Record<string, unknown> | null = null;
	if (route.shouldFetchDetails && route.eventId) {
		eventDetails = await fetchEventDetails("primary", route.eventId);
	}

	let shouldNotify = false;
	let notificationMessage = "";

	switch (route.eventType) {
		case "created": {
			if (eventDetails) {
				const result = await handleEventCreated(eventDetails);
				shouldNotify = result.shouldNotify;
				notificationMessage = result.message;
			}
			break;
		}
		case "updated": {
			if (eventDetails) {
				const result = await handleEventUpdated(eventDetails);
				shouldNotify = result.shouldNotify;
				notificationMessage = result.message;
			}
			break;
		}
		case "deleted": {
			if (route.eventId) {
				await handleEventDeleted(route.eventId);
			}
			break;
		}
	}

	if (shouldNotify && notificationMessage) {
		const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID ?? "default-chat";
		await sendTelegramNotification(chatId, notificationMessage);
	}

	await logCalendarEvent("info", "Calendar event processed", {
		eventType: route.eventType,
		calendarId: "primary",
		processed: true,
	});

	return { eventType: route.eventType, notified: shouldNotify };
}
