/**
 * Workflow: Check Overdue Tasks
 * 
 * После интеграции с App A (task-manager),
 * этот workflow периодически проверяет просроченные задачи и отправляет уведомления
 * 
 * ПРИМЕЧАНИЕ: Это псевдокод для иллюстрации идеи.
 * Реальная реализация будет использовать @c4c/workflow API.
 */

import { workflow, step } from '@c4c/workflow';
import { z } from 'zod';

// Шаг 1: Получить задачи из App A
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

// Шаг 2: Отправить уведомление
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
 * Как это работает:
 * 
 * 1. Cron trigger запускается каждый день в 9:00
 * 2. Шаг 1 вызывает task-manager.tasks.list (из App A!)
 * 3. Шаг 2 вызывает notifications.send (локальная процедура App B)
 * 4. Пользователь получает email с количеством просроченных задач
 */

// Альтернативный вариант (псевдокод):
/*
export const checkOverdueTasksV2 = {
  id: 'check-overdue-tasks-v2',
  name: 'Check for overdue tasks and notify',
  
  trigger: {
    type: 'schedule',
    schedule: '0 9 * * *', // Каждый день в 9:00
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
      procedureName: 'task-manager.tasks.list', // ← Из App A!
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
