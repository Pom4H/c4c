/**
 * Telegram Bot Workflow
 *
 * Uses "use workflow" / "use step" directives from the Workflow DevKit.
 */

async function routeEvent(update: Record<string, unknown>) {
	"use step";
	if (update.message) return { eventType: "message" as const };
	if (update.callback_query) return { eventType: "callback_query" as const };
	return { eventType: "unknown" as const };
}

async function handleMessage(update: Record<string, unknown>) {
	"use step";
	const message = update.message as Record<string, unknown>;
	const text = (message?.text as string) ?? "";
	console.log(`[handle-message] Received: "${text}"`);

	if (text.startsWith("/start")) return { shouldReply: true, reply: "Welcome! I'm your bot." };
	if (text.startsWith("/help")) return { shouldReply: true, reply: "Available: /start, /help, /status" };
	if (text.startsWith("/status")) return { shouldReply: true, reply: "All systems operational." };
	return { shouldReply: true, reply: `Echo: ${text}` };
}

async function sendTelegramMessage(chatId: string, text: string) {
	"use step";
	console.log(`[telegram.sendMessage] To ${chatId}: ${text}`);
	return { ok: true, messageId: `msg_${Date.now()}` };
}

async function handleCallbackQuery(update: Record<string, unknown>) {
	"use step";
	const callbackQuery = update.callback_query as Record<string, unknown>;
	const data = callbackQuery?.data as string;
	return { answer: `Processed: ${data}`, showAlert: false };
}

async function answerCallbackQuery(callbackQueryId: string, text: string) {
	"use step";
	console.log(`[answerCallbackQuery] ${callbackQueryId}: ${text}`);
	return { ok: true };
}

async function logTelegramEvent(message: string, data: unknown) {
	"use step";
	console.log(`[log] ${message}`, data);
}

export async function telegramBotWorkflow(update: Record<string, unknown>) {
	"use workflow";

	const { eventType } = await routeEvent(update);

	if (eventType === "message") {
		const { shouldReply, reply } = await handleMessage(update);
		if (shouldReply && reply) {
			const message = update.message as Record<string, unknown>;
			const chat = message?.chat as Record<string, unknown>;
			await sendTelegramMessage(String(chat?.id ?? ""), reply);
		}
	} else if (eventType === "callback_query") {
		const { answer } = await handleCallbackQuery(update);
		const callbackQuery = update.callback_query as Record<string, unknown>;
		await answerCallbackQuery(String(callbackQuery?.id ?? ""), answer);
	}

	await logTelegramEvent("Telegram event processed", { eventType, processed: true });
	return { eventType, processed: true };
}
