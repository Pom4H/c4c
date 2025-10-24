/**
 * Server with Trigger Handlers
 * 
 * Demonstrates complete server setup with triggers and handlers
 */

import { createRegistry } from '@c4c/core';
import { createHttpServer, WebhookRegistry } from '@c4c/adapters';

// ==========================================
// IMPORT GENERATED PROCEDURES
// ==========================================

// Telegram procedures (auto-generated)
import { TelegramProcedures } from '../../procedures/integrations/telegram/procedures.gen.js';

// Google Calendar procedures (auto-generated)
import { GoogleCalendarProcedures } from '../../procedures/integrations/google-calendar/procedures.gen.js';

// ==========================================
// IMPORT OUR HANDLERS
// ==========================================

import { TelegramHandlers } from './handlers/telegram-handler.js';
import { GoogleCalendarHandlers } from './handlers/google-calendar-handler.js';

// ==========================================
// IMPORT WORKFLOWS
// ==========================================

import { telegramBotWorkflow } from './workflows/telegram-bot-workflow.js';
import { googleCalendarWorkflow } from './workflows/google-calendar-workflow.js';

// ==========================================
// SETUP REGISTRY
// ==========================================

const registry = createRegistry();

// Register generated procedures (triggers)
console.log('📦 Registering generated procedures...');

for (const procedure of TelegramProcedures) {
  registry.register(procedure);
  console.log(`  ✓ ${procedure.contract.name}`);
}

for (const procedure of GoogleCalendarProcedures) {
  registry.register(procedure);
  console.log(`  ✓ ${procedure.contract.name}`);
}

// Register our handlers
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
// SETUP WEBHOOK REGISTRY
// ==========================================

const webhookRegistry = new WebhookRegistry();

// Register handler for Telegram
webhookRegistry.registerHandler('telegram', async (event) => {
  console.log(`\n📨 [Telegram] Received webhook event:`);
  console.log(`   Update ID: ${(event.payload as any)?.update_id}`);
  console.log(`   Event Type: ${event.eventType || 'unknown'}`);
  
  // Here you can start a workflow or process directly
  // Workflow engine will automatically call registered handlers
});

// Register handler for Google Calendar
webhookRegistry.registerHandler('google-calendar', async (event) => {
  console.log(`\n📅 [Google Calendar] Received webhook event:`);
  console.log(`   Resource State: ${event.headers['x-goog-resource-state']}`);
  console.log(`   Channel ID: ${event.headers['x-goog-channel-id']}`);
  
  // Workflow engine will process the event automatically
});

// ==========================================
// START SERVER
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
