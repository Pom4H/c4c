/**
 * MONOLITH MODE - App A Running Standalone
 * 
 * This demonstrates the workflow running entirely within app-a
 * using only local procedures.
 */

import { createRegistry } from '@c4c/core';
import { emitTriggerEvent, registerTriggerHandler } from '@c4c/workflow';
import { taskCreatedTrigger, taskUpdatedTrigger } from './procedures/tasks.js';
import { taskNotificationWorkflow } from './workflows/task-notification-workflow.js';

// Import all procedures
import { TaskProcedures } from './procedures/tasks.js';

// Create registry and register procedures
const registry = createRegistry();

console.log('🏗️  MONOLITH MODE - App A Standalone\n');
console.log('━'.repeat(60));

// Register task procedures
console.log('\n📦 Registering procedures...\n');
for (const proc of TaskProcedures) {
  registry.register(proc);
  console.log(`  ✓ ${proc.contract.name}`);
}

// Register trigger procedures
registry.register(taskCreatedTrigger);
console.log(`  ✓ ${taskCreatedTrigger.contract.name} (trigger)`);

registry.register(taskUpdatedTrigger);
console.log(`  ✓ ${taskUpdatedTrigger.contract.name} (trigger)`);

// Register a local notification stub (since we don't have app-b)
registry.register({
  contract: {
    name: 'notifications.send',
    description: 'Send notification (local stub)',
    input: {} as any,
    output: {} as any,
  },
  handler: async (input) => {
    console.log('\n  📧 [Local Notification Stub]');
    console.log(`     Message: ${input.message}`);
    console.log(`     Channel: ${input.channel}`);
    return {
      id: `notif_${Date.now()}`,
      message: input.message,
      channel: input.channel,
      status: 'sent',
    };
  },
});
console.log(`  ✓ notifications.send (local stub)`);

// Register workflow
console.log('\n🔄 Registering workflow...\n');
registerTriggerHandler(
  'tasks.trigger.created',
  taskNotificationWorkflow,
  registry
);
console.log(`  ✓ ${taskNotificationWorkflow.name}`);

console.log('\n━'.repeat(60));
console.log('\n✨ Monolith setup complete!\n');

// Demonstrate workflow execution
async function createTaskWithNotification() {
  console.log('📝 Creating a new task...\n');
  
  // Simulate task creation
  const task = {
    id: 'task_123',
    title: 'Implement feature X',
    description: 'Add new feature to the system',
    status: 'todo',
    priority: 'high',
    assigneeId: 'user_456',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  console.log(`  Task created: ${task.title} (${task.id})`);
  
  // Emit trigger event (MONOLITH MODE)
  console.log('\n🎯 Emitting trigger event (monolith mode)...\n');
  await emitTriggerEvent('tasks.trigger.created', task, registry);
  
  console.log('\n━'.repeat(60));
  console.log('\n✅ Task created and notification sent!\n');
  console.log('💡 Notice: Workflow used local procedures only.\n');
}

// Run demo
createTaskWithNotification().catch(console.error);

/**
 * OUTPUT EXPLANATION:
 * 
 * In MONOLITH MODE:
 * - Task created → emitTriggerEvent()
 * - Trigger fires → workflow executes
 * - Uses local procedures (tasks.get, notifications.send stub)
 * - All happens in one process
 * 
 * Next: See microservices-mode.ts for the SAME workflow
 * running across services with NO CODE CHANGES!
 */
