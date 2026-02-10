/**
 * Google Calendar Workflow
 *
 * Handles changes in Google Calendar and sends notifications.
 * Demonstrates the "use workflow" / step() pattern for event-driven workflows.
 *
 * Before (old DSL): Complex WorkflowDefinition object with trigger config and step arrays
 * After: Plain async function with steps and standard JS control flow
 */

import { step, FatalError, createHook } from "@c4c/workflow";

// Steps

const routeCalendarEvent = step("google.calendar.route.event", async (notification: unknown) => {
	const data = notification as Record<string, unknown>;
	console.log("[route] Routing calendar event:", data);

	// Determine event type from notification
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
});

const fetchEventDetails = step("google.calendar.events.get", async (calendarId: string, eventId: string) => {
	console.log(`[fetch] Getting event ${eventId} from calendar ${calendarId}`);
	// Mock: would call Google Calendar API
	return {
		id: eventId,
		summary: "Team Meeting",
		start: { dateTime: new Date().toISOString() },
		end: { dateTime: new Date(Date.now() + 3600000).toISOString() },
		attendees: [{ email: "alice@example.com" }, { email: "bob@example.com" }],
	};
});

const handleEventCreated = step("google.calendar.handle.created", async (event: Record<string, unknown>) => {
	console.log("[handle-created] New event:", event.summary);
	return {
		shouldNotify: true,
		message: `*New Calendar Event*\n${event.summary}`,
	};
});

const handleEventUpdated = step("google.calendar.handle.updated", async (event: Record<string, unknown>) => {
	console.log("[handle-updated] Updated event:", event.summary);
	return {
		shouldNotify: true,
		message: `*Updated Calendar Event*\n${event.summary}`,
	};
});

const handleEventDeleted = step("google.calendar.handle.deleted", async (eventId: string) => {
	console.log("[handle-deleted] Deleted event:", eventId);
	return { shouldNotify: false };
});

const sendTelegramNotification = step("telegram.sendMessage", async (chatId: string, text: string) => {
	console.log(`[telegram] Sending to ${chatId}: ${text}`);
	// Mock: would call Telegram Bot API
	return { ok: true, messageId: `msg_${Date.now()}` };
});

const logEvent = step("system.log", async (level: string, message: string, data: unknown) => {
	console.log(`[${level}] ${message}`, data);
});

/**
 * Google Calendar Event Sync Workflow
 *
 * Standard async function - no DAG, no config objects.
 * Control flow uses if/else, try/catch, and standard JS patterns.
 */
export async function googleCalendarSync(notification: unknown) {
	"use workflow";

	console.log("Google Calendar sync workflow started");

	// Step 1: Route the event
	const route = await routeCalendarEvent(notification);
	console.log("Event type:", route.eventType);

	// Step 2: Fetch details if needed (conditional - just use if!)
	let eventDetails: Record<string, unknown> | null = null;
	if (route.shouldFetchDetails && route.eventId) {
		eventDetails = await fetchEventDetails("primary", route.eventId);
	}

	// Step 3: Handle based on event type (conditional - just use switch!)
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
				const result = await handleEventDeleted(route.eventId);
				shouldNotify = result.shouldNotify;
			}
			break;
		}
	}

	// Step 4: Send Telegram notification if needed
	if (shouldNotify && notificationMessage) {
		const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID ?? "default-chat";
		await sendTelegramNotification(chatId, notificationMessage);
	}

	// Step 5: Log the event
	await logEvent("info", "Calendar event processed", {
		eventType: route.eventType,
		calendarId: "primary",
		processed: true,
	});

	return { eventType: route.eventType, notified: shouldNotify };
}
