/**
 * Workflow: Check Overdue Tasks
 * 
 * After integration with App A (task-manager),
 * this workflow periodically checks for overdue tasks and sends notifications
 * 
 * NOTE: This is pseudocode to illustrate the idea.
 * Real implementation will use @c4c/workflow API.
 */

import { workflow, step } from '@c4c/workflow';
import { z } from 'zod';

// Step 1: Get tasks from App A
const getTasks = step({
  id: 'get-tasks',
  input: z.object({}),
  output: z.object({
    tasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      dueDate: z.string().optional(),
      assignee: z.string().optional(),
    })),
    total: z.number(),
  }),
  execute: ({ engine }) => 
    engine.run('task-manager.tasks.list', { status: 'in_progress' }),
});

// Step 2: Send notification
const sendOverdueNotification = step({
  id: 'send-notification',
  input: z.object({
    count: z.number(),
  }),
  output: z.object({
    id: z.string(),
    message: z.string(),
  }),
  execute: ({ engine, inputData }) => 
    engine.run('notifications.send', {
      message: `⚠️ You have ${inputData.count} overdue task(s)!`,
      channel: 'email',
      priority: 'high',
    }),
});

export const checkOverdueTasks = workflow('check-overdue-tasks')
  .step(getTasks)
  .step(sendOverdueNotification)
  .commit();

/**
 * How it works:
 * 
 * 1. Cron trigger runs every day at 9:00 AM
 * 2. Step 1 calls task-manager.tasks.list (from App A!)
 * 3. Step 2 calls notifications.send (local procedure of App B)
 * 4. User receives email with count of overdue tasks
 */

// Alternative variant (pseudocode):
/*
export const checkOverdueTasksV2 = {
  id: 'check-overdue-tasks-v2',
  name: 'Check for overdue tasks and notify',
  
  trigger: {
    type: 'schedule',
    schedule: '0 9 * * *', // Every day at 9:00 AM
  },
  
  nodes: [
    {
      id: 'start',
      type: 'trigger',
      procedureName: 'schedule.daily',
      next: 'get-tasks',
    },
    {
      id: 'get-tasks',
      type: 'procedure',
      procedureName: 'task-manager.tasks.list', // ← From App A!
      next: 'send-notification',
    },
    {
      id: 'send-notification',
      type: 'procedure',
      procedureName: 'notifications.send',
      next: 'end',
    },
    {
      id: 'end',
      type: 'procedure',
      procedureName: 'system.log',
    },
  ],
  startNode: 'start',
};
*/
