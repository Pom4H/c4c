/**
 * Task Notification Workflow
 * 
 * This workflow demonstrates the key principle:
 * SAME WORKFLOW works in both monolith and microservices!
 * 
 * MONOLITH MODE (app-a standalone):
 * - Task created → emitTriggerEvent('tasks.trigger.created', task)
 * - Workflow executes → sends notification using local procedures
 * 
 * MICROSERVICES MODE (after c4c integrate):
 * - Task created in app-a → POST /webhooks/tasks
 * - App-b receives webhook → tasks.trigger.created
 * - SAME workflow executes → sends notification via integrated procedures
 * 
 * THE WORKFLOW CODE IS IDENTICAL! Only the trigger invocation changes.
 */

import { workflow, step } from '@c4c/workflow';
import { z } from 'zod';

/**
 * Step 1: Get task details
 */
const getTaskDetails = step({
  id: 'get-task',
  input: z.object({
    id: z.string(),
  }),
  output: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    status: z.string(),
    priority: z.string().optional(),
    assigneeId: z.string().optional(),
  }),
  procedure: 'tasks.get',
});

/**
 * Step 2: Send notification
 * 
 * MONOLITH: Uses local notification procedure
 * MICROSERVICES: Uses notification-service.notifications.send (via c4c integrate)
 */
const sendNotification = step({
  id: 'send-notification',
  input: z.object({
    message: z.string(),
    channel: z.string(),
    priority: z.string().optional(),
  }),
  output: z.object({
    id: z.string(),
    message: z.string(),
    channel: z.string(),
    status: z.string(),
  }),
  // In monolith: will use local stub
  // After integrate: will automatically use notification-service.notifications.send
  procedure: 'notifications.send',
  config: {
    channel: 'push',
  },
});

/**
 * Assemble the workflow
 * 
 * This workflow definition is PORTABLE:
 * - Works in monolith
 * - Works in microservices
 * - NO CHANGES NEEDED when migrating!
 */
export const taskNotificationWorkflow = workflow('task-notification')
  .name('Task Notification Workflow')
  .description('Send notification when task is created')
  .trigger({
    provider: 'tasks',
    triggerProcedure: 'tasks.trigger.created',
  })
  .step(getTaskDetails)
  .step(sendNotification)
  .commit();

/**
 * Alternative: Declarative definition (also portable!)
 */
export const taskNotificationWorkflowDeclarative = {
  id: 'task-notification-declarative',
  name: 'Task Notification (Declarative)',
  version: '1.0.0',
  
  // Trigger configuration (works for both monolith and microservices)
  trigger: {
    provider: 'tasks',
    triggerProcedure: 'tasks.trigger.created',
  },
  
  nodes: [
    {
      id: 'get-task',
      type: 'procedure' as const,
      procedureName: 'tasks.get',
      config: {
        id: '{{ trigger.data.id }}',
      },
      next: 'send-notification',
    },
    {
      id: 'send-notification',
      type: 'procedure' as const,
      // After integrate, this will resolve to notification-service.notifications.send
      procedureName: 'notifications.send',
      config: {
        message: '🆕 New task: {{ steps["get-task"].output.title }}',
        channel: 'push',
        priority: '{{ steps["get-task"].output.priority }}',
      },
    },
  ],
  
  startNode: 'get-task',
};

/**
 * How it works:
 * 
 * MONOLITH (app-a only):
 * 1. Create task → emitTriggerEvent('tasks.trigger.created', task)
 * 2. Trigger fires → workflow executes
 * 3. tasks.get (local) → notifications.send (local stub)
 * 
 * MICROSERVICES (after c4c integrate with app-b):
 * 1. Create task → POST /webhooks/tasks (to app-b)
 * 2. App-b receives → tasks.trigger.created → workflow executes
 * 3. tasks.get (via integrate) → notifications.send (app-b native)
 * 
 * WORKFLOW CODE: IDENTICAL IN BOTH CASES! ✅
 */
