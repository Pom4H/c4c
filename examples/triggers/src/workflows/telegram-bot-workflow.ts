/**
 * Telegram Bot Workflow
 *
 * Handles incoming Telegram messages and callback queries.
 * Demonstrates event-driven workflow with branching logic.
 *
 * Before (old DSL): Complex WorkflowDefinition with trigger and steps arrays
 * After: Plain async function with steps and JavaScript control flow
 */

import { step } from "@c4c/workflow";

// Steps

const routeEvent = step("telegram.route.event", async (update: Record<string, unknown>) => {
	console.log("[route] Routing Telegram update:", update.update_id);

	if (update.message) {
		return { eventType: "message" as const };
	}
	if (update.callback_query) {
		return { eventType: "callback_query" as const };
	}
	return { eventType: "unknown" as const };
});

const handleMessage = step("telegram.handle.message", async (update: Record<string, unknown>) => {
	const message = update.message as Record<string, unknown>;
	const text = (message?.text as string) ?? "";
	const chatId = (message?.chat as Record<string, unknown>)?.id as string;

	console.log(`[handle-message] Received: "${text}" from chat ${chatId}`);

	// Simple command handling
	if (text.startsWith("/start")) {
		return { shouldReply: true, reply: "Welcome! I'm your bot." };
	}
	if (text.startsWith("/help")) {
		return { shouldReply: true, reply: "Available commands: /start, /help, /status" };
	}
	if (text.startsWith("/status")) {
		return { shouldReply: true, reply: "All systems operational." };
	}

	return { shouldReply: true, reply: `Echo: ${text}` };
});

const sendTelegramMessage = step("telegram.sendMessage", async (chatId: string, text: string, parseMode?: string) => {
	console.log(`[telegram.sendMessage] Sending to ${chatId}: ${text}`);
	// Mock: would call Telegram Bot API
	return { ok: true, messageId: `msg_${Date.now()}` };
});

const handleCallbackQuery = step("telegram.handle.callback", async (update: Record<string, unknown>) => {
	const callbackQuery = update.callback_query as Record<string, unknown>;
	const data = callbackQuery?.data as string;
	console.log(`[handle-callback] Callback data: ${data}`);

	return {
		answer: `Processed: ${data}`,
		showAlert: false,
	};
});

const answerCallbackQuery = step("telegram.answerCallbackQuery", async (callbackQueryId: string, text: string, showAlert: boolean) => {
	console.log(`[answerCallbackQuery] Answering ${callbackQueryId}: ${text}`);
	// Mock: would call Telegram Bot API
	return { ok: true };
});

const logEvent = step("system.log", async (message: string, data: unknown) => {
	console.log(`[log] ${message}`, data);
});

/**
 * Telegram Bot Message Handler Workflow
 *
 * Handles incoming Telegram updates using standard JavaScript control flow.
 */
export async function telegramBotWorkflow(update: Record<string, unknown>) {
	"use workflow";

	console.log("Telegram bot workflow started");

	// Step 1: Route the event
	const { eventType } = await routeEvent(update);
	console.log("Event type:", eventType);

	// Step 2-3: Handle based on event type
	if (eventType === "message") {
		const { shouldReply, reply } = await handleMessage(update);

		if (shouldReply && reply) {
			const message = update.message as Record<string, unknown>;
			const chat = message?.chat as Record<string, unknown>;
			const chatId = String(chat?.id ?? "");
			await sendTelegramMessage(chatId, reply, "Markdown");
		}
	} else if (eventType === "callback_query") {
		const { answer, showAlert } = await handleCallbackQuery(update);

		const callbackQuery = update.callback_query as Record<string, unknown>;
		const callbackQueryId = String(callbackQuery?.id ?? "");
		await answerCallbackQuery(callbackQueryId, answer, showAlert);
	}

	// Step 4: Log the event
	await logEvent("Telegram event processed", {
		updateId: update.update_id,
		eventType,
		processed: true,
	});

	return { eventType, processed: true };
}
