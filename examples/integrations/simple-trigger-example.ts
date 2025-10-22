/**
 * Simple Trigger Example - Simplified Approach
 * 
 * Демонстрирует упрощенный подход к работе с триггерами.
 * Никаких pause/resume, никакого ручного управления подписками.
 */

import { collectRegistry } from "@c4c/core";
import { createTriggerWorkflowManager, type WorkflowDefinition } from "@c4c/workflow";
import { WebhookRegistry, createHttpServer } from "@c4c/adapters";

/**
 * 1. Определяем workflow с триггером
 */
const googleDriveMonitor: WorkflowDefinition = {
	id: "drive-monitor",
	name: "Google Drive Monitor",
	version: "1.0.0",
	
	// Это trigger-based workflow
	isTriggered: true,
	
	// Конфигурация триггера
	trigger: {
		provider: "googleDrive",
		triggerProcedure: "googleDrive.drive.changes.watch",
		eventType: "change", // Обрабатывать только "change" события
	},
	
	startNode: "on-file-change",
	
	nodes: [
		// Trigger node - точка входа
		{
			id: "on-file-change",
			type: "trigger",
			procedureName: "googleDrive.drive.changes.watch",
			next: "log-event",
		},
		
		// Логировать событие
		{
			id: "log-event",
			type: "procedure",
			procedureName: "custom.log",
			config: {
				message: "📁 File changed: {{ trigger.payload.file.name }}",
			},
			next: "process-file",
		},
		
		// Обработать файл
		{
			id: "process-file",
			type: "procedure",
			procedureName: "custom.processFile",
			config: {
				fileId: "{{ trigger.payload.fileId }}",
				fileName: "{{ trigger.payload.file.name }}",
			},
		},
	],
};

/**
 * 2. Запускаем систему
 */
async function main() {
	console.log("🚀 Starting trigger example...\n");
	
	// Загружаем registry с процедурами
	const registry = await collectRegistry("./procedures");
	
	// Создаем webhook registry
	const webhookRegistry = new WebhookRegistry();
	
	// Создаем trigger manager
	const triggerManager = createTriggerWorkflowManager(registry, webhookRegistry);
	
	// Запускаем HTTP сервер для приема webhook'ов
	const server = createHttpServer(registry, 3000, {
		enableWebhooks: true,
		webhookRegistry,
	});
	
	console.log("✅ HTTP Server running on port 3000");
	console.log("📡 Webhook endpoint: http://localhost:3000/webhooks/googleDrive\n");
	
	// Деплоим workflow - автоматически создаст webhook subscription
	console.log("📦 Deploying workflow...");
	
	const subscription = await triggerManager.deploy(googleDriveMonitor, {
		webhookUrl: "http://localhost:3000/webhooks/googleDrive",
	});
	
	console.log("✅ Workflow deployed successfully!");
	console.log("   Workflow ID:", subscription.workflowId);
	console.log("   Subscription ID:", subscription.subscriptionId);
	console.log("   Provider:", subscription.provider);
	console.log("   Expires:", subscription.expiresAt || "Never");
	console.log();
	
	console.log("🎯 System is ready!");
	console.log("   Waiting for Google Drive events...");
	console.log("   When a file changes:");
	console.log("   1. Google Drive sends webhook");
	console.log("   2. Workflow executes automatically");
	console.log("   3. Workflow completes and exits");
	console.log();
	
	// Graceful shutdown
	process.on("SIGINT", async () => {
		console.log("\n\n🛑 Shutting down...");
		
		// Останавливаем все workflows (автоматически cleanup subscriptions)
		await triggerManager.stopAll();
		
		console.log("✅ All workflows stopped");
		console.log("👋 Goodbye!");
		
		process.exit(0);
	});
}

/**
 * Запускаем пример
 */
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error("❌ Fatal error:", error);
		process.exit(1);
	});
}

/**
 * Сравнение подходов:
 * 
 * СТАРЫЙ ПОДХОД (сложный):
 * ❌ Создать subscription node
 * ❌ Создать pause node
 * ❌ Вручную регистрировать EventRouter
 * ❌ Регистрировать resume handlers
 * ❌ Управлять жизненным циклом в workflow логике
 * ❌ Loop обратно к pause
 * 
 * НОВЫЙ ПОДХОД (простой):
 * ✅ Объявить trigger node
 * ✅ Вызвать triggerManager.deploy()
 * ✅ Всё остальное автоматически
 * 
 * 
 * Что происходит под капотом:
 * 
 * 1. DEPLOYMENT
 *    triggerManager.deploy() →
 *    - Вызывает googleDrive.drive.changes.watch
 *    - Получает subscription info
 *    - Регистрирует event handler
 *    - Сохраняет для cleanup
 * 
 * 2. EVENT ARRIVAL
 *    Google Drive → webhook POST →
 *    - HTTP Server принимает
 *    - WebhookRegistry dispatches
 *    - TriggerWorkflowManager получает event
 *    - Запускает executeWorkflow() с event data
 *    - Workflow выполняется и завершается
 * 
 * 3. CLEANUP
 *    triggerManager.stop() →
 *    - Находит stop procedure
 *    - Вызывает googleDrive.drive.channels.stop
 *    - Удаляет event handler
 *    - Очищает subscription
 */
