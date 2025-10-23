/**
 * Task Manager App (App A)
 * 
 * Provides task management with webhooks
 * Port: 3001
 */

import { createRegistry } from '@c4c/core';
import { createHttpServer } from '@c4c/adapters';
import { TaskProcedures } from '../procedures/tasks.js';

const PORT = 3001;

// Create registry and register procedures
const registry = createRegistry();

console.log('📦 Registering Task Management procedures...');
for (const procedure of TaskProcedures) {
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

console.log(`\n🚀 Task Manager App started!`);
console.log(`   Port: ${PORT}`);
console.log(`   OpenAPI: http://localhost:${PORT}/openapi.json`);
console.log(`   Docs: http://localhost:${PORT}/docs`);
console.log(`\n💡 Integration:`);
console.log(`   Other apps can integrate with:`);
console.log(`   c4c integrate http://localhost:${PORT}/openapi.json --name task-manager`);
console.log(`\n📊 Available procedures:`);

for (const [name, proc] of registry.entries()) {
  const isTrigger = proc.contract.metadata?.type === 'trigger';
  console.log(`   - ${name}${isTrigger ? ' (trigger)' : ''}`);
}
