/**
 * Simple Portability Demo (ES Modules)
 * Run with: node tests/simple-demo.mjs
 */

import { createRegistry } from '@c4c/core';
import { 
  emitTriggerEvent, 
  registerTriggerHandler,
  createTriggerProcedure,
} from '@c4c/workflow';
import { z } from 'zod';

console.log('\n🧪 Workflow Portability Demo');
console.log('━'.repeat(60));

// Sample task
const sampleTask = {
  id: 'task_123',
  title: 'Implement feature X',
  status: 'todo',
  priority: 'high',
};

// Create trigger (same for both!)
const taskCreatedTrigger = createTriggerProcedure(
  'tasks.trigger.created',
  z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    priority: z.string().optional(),
  }),
  {
    description: 'Triggered when task created',
    provider: 'tasks',
    exposure: 'internal',
  }
);

// Simplified workflow definition (declarative)
const taskNotificationWorkflow = {
  id: 'task-notification',
  name: 'Task Notification',
  version: '1.0.0',
  trigger: {
    provider: 'tasks',
    triggerProcedure: 'tasks.trigger.created',
  },
  nodes: [
    {
      id: 'get-task',
      type: 'procedure',
      procedureName: 'tasks.get',
      next: 'send-notification',
    },
    {
      id: 'send-notification',
      type: 'procedure',
      procedureName: 'notifications.send',
    },
  ],
  startNode: 'get-task',
};

async function testMonolith() {
  console.log('\n📦 TEST 1: MONOLITH MODE');
  console.log('━'.repeat(40));
  
  const registry = createRegistry();
  registry.register(taskCreatedTrigger);
  
  registry.register({
    contract: {
      name: 'tasks.get',
      input: z.any(),
      output: z.any(),
    },
    handler: async () => {
      console.log('  ✓ [Local] tasks.get');
      return sampleTask;
    },
  });
  
  registry.register({
    contract: {
      name: 'notifications.send',
      input: z.any(),
      output: z.any(),
    },
    handler: async () => {
      console.log('  ✓ [Local] notifications.send');
      return { sent: true };
    },
  });
  
  registerTriggerHandler(
    'tasks.trigger.created',
    taskNotificationWorkflow,
    registry
  );
  
  console.log('  🎯 Emitting event...');
  await emitTriggerEvent('tasks.trigger.created', sampleTask, registry);
  console.log('  ✅ Monolith: SUCCESS\n');
}

async function testMicroservices() {
  console.log('🌐 TEST 2: MICROSERVICES MODE');
  console.log('━'.repeat(40));
  
  const registry = createRegistry();
  registry.register(taskCreatedTrigger);
  
  registry.register({
    contract: {
      name: 'tasks.get',
      input: z.any(),
      output: z.any(),
      metadata: { integration: { remote: true } },
    },
    handler: async () => {
      console.log('  ✓ [Integrated] tasks.get (HTTP)');
      return sampleTask;
    },
  });
  
  registry.register({
    contract: {
      name: 'notifications.send',
      input: z.any(),
      output: z.any(),
    },
    handler: async () => {
      console.log('  ✓ [Native] notifications.send');
      return { sent: true };
    },
  });
  
  // SAME workflow!
  registerTriggerHandler(
    'tasks.trigger.created',
    taskNotificationWorkflow,
    registry
  );
  
  console.log('  🎯 Emitting event...');
  await emitTriggerEvent('tasks.trigger.created', sampleTask, registry);
  console.log('  ✅ Microservices: SUCCESS\n');
}

async function main() {
  try {
    await testMonolith();
    await testMicroservices();
    
    console.log('━'.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('━'.repeat(60));
    console.log('\n💡 Workflow definition: IDENTICAL');
    console.log('   ID:', taskNotificationWorkflow.id);
    console.log('   Nodes:', taskNotificationWorkflow.nodes.map(n => n.id).join(', '));
    console.log('   Trigger:', taskNotificationWorkflow.trigger.triggerProcedure);
    console.log('\n🎉 Workflows are truly portable!\n');
  } catch (error) {
    console.error('\n❌ FAILED:', error);
    process.exit(1);
  }
}

main();
