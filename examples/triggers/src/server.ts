/**
 * Server with Trigger Handlers
 * 
 * Демонстрирует полную настройку сервера с триггерами и обработчиками
 */

import { createRegistry } from '@c4c/core';
import { createHttpServer, WebhookRegistry } from '@c4c/adapters';

// ==========================================
// ИМПОРТ СГЕНЕРИРОВАННЫХ ПРОЦЕДУР
// ==========================================

// Telegram procedures (auto-generated)
import { TelegramProcedures } from '../../procedures/integrations/telegram/procedures.gen.js';

// Google Calendar procedures (auto-generated)
import { GoogleCalendarProcedures } from '../../procedures/integrations/google-calendar/procedures.gen.js';

// ==========================================
// ИМПОРТ НАШИХ ОБРАБОТЧИКОВ
// ==========================================

import { TelegramHandlers } from './handlers/telegram-handler.js';
import { GoogleCalendarHandlers } from './handlers/google-calendar-handler.js';

// ==========================================
// ИМПОРТ WORKFLOWS
// ==========================================

import { telegramBotWorkflow } from './workflows/telegram-bot-workflow.js';
import { googleCalendarWorkflow } from './workflows/google-calendar-workflow.js';

// ==========================================
// НАСТРОЙКА REGISTRY
// ==========================================

const registry = createRegistry();

// Регистрируем сгенерированные процедуры (триггеры)
console.log('📦 Registering generated procedures...');

for (const procedure of TelegramProcedures) {
  registry.register(procedure);
  console.log(`  ✓ ${procedure.contract.name}`);
}

for (const procedure of GoogleCalendarProcedures) {
  registry.register(procedure);
  console.log(`  ✓ ${procedure.contract.name}`);
}

// Регистрируем наши обработчики
console.log('\n🔧 Registering event handlers...');

for (const handler of TelegramHandlers) {
  registry.register(handler);
  console.log(`  ✓ ${handler.contract.name}`);
}

for (const handler of GoogleCalendarHandlers) {
  registry.register(handler);
  console.log(`  ✓ ${handler.contract.name}`);
}

// ==========================================
// НАСТРОЙКА WEBHOOK REGISTRY
// ==========================================

const webhookRegistry = new WebhookRegistry();

// Регистрируем обработчик для Telegram
webhookRegistry.registerHandler('telegram', async (event) => {
  console.log(`\n📨 [Telegram] Received webhook event:`);
  console.log(`   Update ID: ${(event.payload as any)?.update_id}`);
  console.log(`   Event Type: ${event.eventType || 'unknown'}`);
  
  // Здесь можно запустить workflow или обработать напрямую
  // Workflow engine автоматически вызовет зарегистрированные обработчики
});

// Регистрируем обработчик для Google Calendar
webhookRegistry.registerHandler('google-calendar', async (event) => {
  console.log(`\n📅 [Google Calendar] Received webhook event:`);
  console.log(`   Resource State: ${event.headers['x-goog-resource-state']}`);
  console.log(`   Channel ID: ${event.headers['x-goog-channel-id']}`);
  
  // Workflow engine обработает событие автоматически
});

// ==========================================
// ЗАПУСК СЕРВЕРА
// ==========================================

const PORT = Number(process.env.PORT) || 3000;

const server = createHttpServer(registry, PORT, {
  enableWebhooks: true,
  webhookRegistry,
  enableDocs: true,
  enableRpc: true,
  enableRest: true,
  enableWorkflow: true,
});

console.log(`\n🚀 Server started on http://localhost:${PORT}`);
console.log(`\n📚 Useful endpoints:`);
console.log(`   Docs:          http://localhost:${PORT}/docs`);
console.log(`   Procedures:    http://localhost:${PORT}/procedures`);
console.log(`   Triggers:      http://localhost:${PORT}/webhooks/triggers`);
console.log(`\n🎯 Webhook endpoints:`);
console.log(`   Telegram:      POST http://localhost:${PORT}/webhooks/telegram`);
console.log(`   Google Cal:    POST http://localhost:${PORT}/webhooks/google-calendar`);
console.log(`\n💡 Test triggers:`);
console.log(`   curl http://localhost:${PORT}/webhooks/triggers`);
