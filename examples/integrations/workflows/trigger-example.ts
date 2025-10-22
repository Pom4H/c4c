/**
 * Example: Using triggers in workflows (SIMPLIFIED APPROACH)
 * 
 * Триггер - это просто точка входа в workflow.
 * Когда приходит событие, workflow запускается и выполняется до конца.
 */

import type { WorkflowDefinition } from "@c4c/workflow";

/**
 * Example 1: Google Drive file monitoring
 * 
 * Мониторит изменения в Google Drive и обрабатывает их
 */
export const googleDriveMonitor: WorkflowDefinition = {
	id: "google-drive-monitor",
	name: "Google Drive File Monitor",
	description: "Monitors Google Drive for file changes and processes them",
	version: "1.0.0",
	
	// Указываем что это trigger-based workflow
	isTriggered: true,
	
	// Конфигурация триггера
	trigger: {
		provider: "googleDrive",
		triggerProcedure: "googleDrive.drive.changes.watch",
		eventType: "change", // Фильтровать только "change" события
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
			procedureName: "custom.logEvent",
			config: {
				message: "File changed: {{ trigger.payload.file.name }}",
				event: "{{ trigger }}",
			},
			next: "check-file-type",
		},
		
		// Проверить тип файла
		{
			id: "check-file-type",
			type: "condition",
			config: {
				expression: "trigger.payload.file.mimeType === 'application/pdf'",
				trueBranch: "process-pdf",
				falseBranch: "skip",
			},
		},
		
		// Обработать PDF
		{
			id: "process-pdf",
			type: "procedure",
			procedureName: "custom.processPDF",
			config: {
				fileId: "{{ trigger.payload.fileId }}",
				fileName: "{{ trigger.payload.file.name }}",
			},
			next: "notify",
		},
		
		// Пропустить не-PDF файлы
		{
			id: "skip",
			type: "procedure",
			procedureName: "custom.log",
			config: {
				message: "Skipped non-PDF file",
			},
		},
		
		// Отправить уведомление
		{
			id: "notify",
			type: "procedure",
			procedureName: "custom.sendNotification",
			config: {
				message: "Processed PDF: {{ trigger.payload.file.name }}",
			},
		},
	],
};

/**
 * Example 2: Slack bot
 * 
 * Реагирует на сообщения в Slack
 */
export const slackBot: WorkflowDefinition = {
	id: "slack-bot",
	name: "Slack Bot",
	description: "Responds to Slack messages",
	version: "1.0.0",
	
	isTriggered: true,
	
	trigger: {
		provider: "slack",
		triggerProcedure: "slack.events.subscribe",
		eventType: "message",
	},
	
	startNode: "on-message",
	
	nodes: [
		{
			id: "on-message",
			type: "trigger",
			procedureName: "slack.events.subscribe",
			next: "parse-command",
		},
		{
			id: "parse-command",
			type: "procedure",
			procedureName: "custom.parseSlackCommand",
			config: {
				text: "{{ trigger.payload.event.text }}",
				user: "{{ trigger.payload.event.user }}",
				channel: "{{ trigger.payload.event.channel }}",
			},
			next: "check-command",
		},
		{
			id: "check-command",
			type: "condition",
			config: {
				expression: "outputs['parse-command'].isCommand === true",
				trueBranch: "execute-command",
				falseBranch: "ignore",
			},
		},
		{
			id: "execute-command",
			type: "procedure",
			procedureName: "custom.executeSlackCommand",
		},
		{
			id: "ignore",
			type: "procedure",
			procedureName: "custom.log",
			config: {
				message: "Not a command, ignoring",
			},
		},
	],
};

/**
 * Example 3: Multi-step processing with error handling
 * 
 * Более сложный workflow с обработкой ошибок
 */
export const complexTriggerWorkflow: WorkflowDefinition = {
	id: "complex-trigger-workflow",
	name: "Complex Trigger Workflow",
	version: "1.0.0",
	
	isTriggered: true,
	
	trigger: {
		provider: "googleDrive",
		triggerProcedure: "googleDrive.drive.changes.watch",
		subscriptionConfig: {
			// Можно передать дополнительную конфигурацию
			pageToken: "start-token",
		},
	},
	
	startNode: "trigger",
	
	nodes: [
		{
			id: "trigger",
			type: "trigger",
			procedureName: "googleDrive.drive.changes.watch",
			next: "validate",
		},
		{
			id: "validate",
			type: "procedure",
			procedureName: "custom.validateEvent",
			config: {
				event: "{{ trigger }}",
			},
			next: "parallel-processing",
			onError: "handle-error", // Обработать ошибку
		},
		{
			id: "parallel-processing",
			type: "parallel",
			config: {
				branches: ["download-file", "update-database"],
				waitForAll: true,
			},
			next: "finalize",
		},
		{
			id: "download-file",
			type: "procedure",
			procedureName: "custom.downloadFile",
			config: {
				fileId: "{{ trigger.payload.fileId }}",
			},
		},
		{
			id: "update-database",
			type: "procedure",
			procedureName: "custom.updateDatabase",
			config: {
				fileId: "{{ trigger.payload.fileId }}",
				metadata: "{{ trigger.payload.file }}",
			},
		},
		{
			id: "finalize",
			type: "procedure",
			procedureName: "custom.finalize",
			config: {
				message: "Processing complete",
			},
		},
		{
			id: "handle-error",
			type: "procedure",
			procedureName: "custom.handleError",
			config: {
				error: "{{ error }}",
				event: "{{ trigger }}",
			},
		},
	],
};

/**
 * Usage example:
 */
export async function deployTriggerWorkflow() {
	// Эта функция показывает как использовать новый подход
	
	const { collectRegistry } = await import("@c4c/core");
	const { createTriggerWorkflowManager } = await import("@c4c/workflow");
	const { WebhookRegistry, createHttpServer } = await import("@c4c/adapters");
	
	// 1. Подготовка
	const registry = await collectRegistry("./procedures");
	const webhookRegistry = new WebhookRegistry();
	const triggerManager = createTriggerWorkflowManager(registry, webhookRegistry);
	
	// 2. Запуск HTTP сервера для webhook'ов
	const server = createHttpServer(registry, 3000, {
		enableWebhooks: true,
		webhookRegistry,
	});
	
	console.log("🚀 Server running on port 3000");
	console.log("📡 Webhook endpoint: http://localhost:3000/webhooks/googleDrive");
	
	// 3. Деплой workflow - автоматически создаст subscription
	const subscription = await triggerManager.deploy(googleDriveMonitor, {
		webhookUrl: "http://localhost:3000/webhooks/googleDrive",
	});
	
	console.log("✅ Workflow deployed:", {
		workflowId: subscription.workflowId,
		subscriptionId: subscription.subscriptionId,
		provider: subscription.provider,
	});
	
	// Workflow теперь слушает события!
	// Когда событие придет:
	// 1. HTTP сервер примет webhook POST
	// 2. TriggerWorkflowManager запустит workflow
	// 3. Workflow выполнится от trigger ноды до конца
	// 4. Workflow завершится
	
	// Для остановки:
	// await triggerManager.stop("google-drive-monitor");
	
	// Или остановить все:
	// await triggerManager.stopAll();
}

/**
 * Comparison with old approach:
 * 
 * OLD (complex):
 * - Create subscription node
 * - Create pause node
 * - Manage EventRouter manually
 * - Register resume handlers
 * - Loop back to pause
 * 
 * NEW (simple):
 * - Just define trigger node
 * - Deploy with triggerManager.deploy()
 * - Everything else is automatic
 */
