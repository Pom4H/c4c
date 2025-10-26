/**
 * Workflow: Notify on Task Created
 * 
 * After integration with App B (notification-service),
 * this workflow automatically sends a notification when a task is created
 */

import { workflow, step } from '@c4c/workflow';
import { z } from 'zod';

// Step 1: Get task details
const getTaskDetails = step({
  id: 'get-task',
  input: z.object({ taskId: z.string() }),
  output: z.object({
    id: z.string(),
    title: z.string(),
    priority: z.string().optional(),
  }),
  execute: ({ engine, inputData }) => 
    engine.run('tasks.get', { id: inputData.taskId }),
});

// Step 2: Send notification via App B (after integration!)
const sendNotification = step({
  id: 'send-notification',
  input: z.object({
    title: z.string(),
    priority: z.string().optional(),
  }),
  output: z.object({
    id: z.string(),
    message: z.string(),
  }),
  execute: ({ engine, inputData }) => 
    engine.run('notification-service.notifications.send', {
      message: `🆕 New task created: ${inputData.title}`,
      channel: 'push',
      priority: inputData.priority === 'high' ? 'urgent' : 'normal',
    }),
});

// Assemble workflow
export const notifyOnTaskCreated = workflow('notify-on-task-created')
  .step(getTaskDetails)
  .step(sendNotification)
  .commit();

/**
 * How it works:
 * 
 * 1. The tasks.trigger.created trigger fires when a task is created
 * 2. Workflow receives taskId from trigger data
 * 3. Step 1 calls tasks.get (local procedure of App A)
 * 4. Step 2 calls notification-service.notifications.send (from App B!)
 * 5. App B receives the request and sends notification
 */
