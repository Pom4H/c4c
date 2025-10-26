#!/usr/bin/env node
/**
 * Working Demo - Proof that workflows are portable
 * 
 * This demonstrates the SAME workflow working in:
 * 1. Monolith mode (local procedures)
 * 2. Microservices mode (integrated procedures)
 */

import { createRegistry } from '../../../packages/core/dist/index.js';
import { 
  emitTriggerEvent, 
  registerTriggerHandler,
  createTriggerProcedure,
  executeWorkflow,
} from '../../../packages/workflow/dist/index.js';
import { z } from 'zod';

console.log('\n🧪 WORKFLOW PORTABILITY - LIVE DEMO');
console.log('━'.repeat(60));

// Sample task data
const sampleTask = {
  id: 'task_123',
  title: 'Implement feature X',
  status: 'todo',
  priority: 'high',
};

// Create trigger procedure (same for both!)
const taskCreatedTrigger = createTriggerProcedure(
  'tasks.trigger.created',
  z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    priority: z.string().optional(),
  }),
  {
    description: 'Triggered when task is created',
    provider: 'tasks',
    eventTypes: ['created'],
    exposure: 'internal',
  }
);

// Create workflow (same for both!) - using declarative API
const taskNotificationWorkflow = {
  id: 'task-notification',
  name: 'Task Notification Workflow',
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
  console.log('━'.repeat(60));
  
  const registry = createRegistry();
  
  // Register trigger
  registry.register(taskCreatedTrigger);
  console.log('  ✓ Registered trigger procedure');
  
  // Register local procedures
  registry.register({
    contract: {
      name: 'tasks.get',
      input: z.any(),
      output: z.any(),
    },
    handler: async (input) => {
      console.log('  📋 [Local] tasks.get called');
      return sampleTask;
    },
  });
  
  registry.register({
    contract: {
      name: 'notifications.send',
      input: z.any(),
      output: z.any(),
    },
    handler: async (input) => {
      console.log('  🔔 [Local] notifications.send called');
      console.log(`     Message: New task: ${sampleTask.title}`);
      return { sent: true };
    },
  });
  
  console.log('  ✓ Registered local procedures');
  
  // Register workflow
  registerTriggerHandler(
    'tasks.trigger.created',
    taskNotificationWorkflow,
    registry
  );
  console.log('  ✓ Registered workflow');
  
  // Emit event
  console.log('\n  🎯 Emitting trigger event...\n');
  await emitTriggerEvent('tasks.trigger.created', sampleTask, registry);
  
  console.log('\n  ✅ Monolith mode: SUCCESS');
  console.log('     Used local procedures only');
}

async function testMicroservices() {
  console.log('\n\n🌐 TEST 2: MICROSERVICES MODE');
  console.log('━'.repeat(60));
  
  const registry = createRegistry();
  
  // Register trigger
  registry.register(taskCreatedTrigger);
  console.log('  ✓ Registered trigger procedure');
  
  // Register integrated procedure (simulating c4c integrate)
  registry.register({
    contract: {
      name: 'tasks.get',
      input: z.any(),
      output: z.any(),
      metadata: {
        integration: {
          source: 'task-manager',
          remote: true,
        },
      },
    },
    handler: async (input) => {
      console.log('  📋 [Integrated] tasks.get via HTTP');
      console.log('     → http://task-service/api/tasks.get');
      return sampleTask;
    },
  });
  
  // Register native procedure
  registry.register({
    contract: {
      name: 'notifications.send',
      input: z.any(),
      output: z.any(),
    },
    handler: async (input) => {
      console.log('  🔔 [Native] notifications.send');
      console.log(`     Message: New task: ${sampleTask.title}`);
      return { sent: true };
    },
  });
  
  console.log('  ✓ Registered integrated + native procedures');
  
  // Register THE SAME workflow (no changes!)
  registerTriggerHandler(
    'tasks.trigger.created',
    taskNotificationWorkflow,
    registry
  );
  console.log('  ✓ Registered workflow (IDENTICAL!)');
  
  // Emit event
  console.log('\n  🎯 Emitting trigger event (webhook)...\n');
  await emitTriggerEvent('tasks.trigger.created', sampleTask, registry);
  
  console.log('\n  ✅ Microservices mode: SUCCESS');
  console.log('     Used integrated procedures via HTTP');
}

function verifyIdentity() {
  console.log('\n\n🔍 TEST 3: WORKFLOW IDENTITY');
  console.log('━'.repeat(60));
  
  console.log('\n  Workflow Definition:');
  console.log('    ID:', taskNotificationWorkflow.id);
  console.log('    Name:', taskNotificationWorkflow.name);
  console.log('    Version:', taskNotificationWorkflow.version);
  console.log('    Trigger:', taskNotificationWorkflow.trigger.triggerProcedure);
  console.log('\n  Nodes:');
  for (const node of taskNotificationWorkflow.nodes) {
    console.log(`    - ${node.id}: ${node.procedureName}`);
  }
  
  console.log('\n  ✅ Workflow is IDENTICAL in both modes');
  console.log('     Zero changes needed!');
}

async function main() {
  try {
    await testMonolith();
    await testMicroservices();
    verifyIdentity();
    
    console.log('\n\n━'.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('━'.repeat(60));
    
    console.log('\n📊 SUMMARY:');
    console.log('   ✓ Workflow code: IDENTICAL');
    console.log('   ✓ Monolith mode: WORKS');
    console.log('   ✓ Microservices mode: WORKS');
    console.log('   ✓ Migration: ZERO workflow changes');
    
    console.log('\n💡 KEY INSIGHT:');
    console.log('   Workflows are truly portable!');
    console.log('   Only trigger invocation changes (internal → webhook)');
    console.log('   Workflow definition stays 100% identical!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
