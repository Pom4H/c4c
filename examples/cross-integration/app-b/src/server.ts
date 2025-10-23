/**
 * Notification Service App (App B)
 * 
 * Provides notification services with webhooks
 * Port: 3002
 */

import { createRegistry } from '@c4c/core';
import { createHttpServer } from '@c4c/adapters';
import { NotificationProcedures } from '../procedures/notifications.js';

const PORT = 3002;

// Create registry and register procedures
const registry = createRegistry();

console.log('📦 Registering Notification Service procedures...');
for (const procedure of NotificationProcedures) {
  registry.register(procedure);
  console.log(`  ✓ ${procedure.contract.name}`);
}

// Start server
const server = createHttpServer(registry, PORT, {
  enableRpc: true,
  enableRest: true,
  enableDocs: true,
  enableWebhooks: true,
  enableWorkflow: true,
});

console.log(`\n🚀 Notification Service App started!`);
console.log(`   Port: ${PORT}`);
console.log(`   OpenAPI: http://localhost:${PORT}/openapi.json`);
console.log(`   Docs: http://localhost:${PORT}/docs`);
console.log(`\n💡 Integration:`);
console.log(`   Other apps can integrate with:`);
console.log(`   c4c integrate http://localhost:${PORT}/openapi.json --name notification-service`);
console.log(`\n📊 Available procedures:`);

for (const [name, proc] of registry.entries()) {
  const isTrigger = proc.contract.metadata?.type === 'trigger';
  console.log(`   - ${name}${isTrigger ? ' (trigger)' : ''}`);
}
