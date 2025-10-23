/**
 * Workflow: Notify on Task Created
 * 
 * После интеграции с App B (notification-service),
 * этот workflow автоматически отправляет уведомление при создании задачи
 * 
 * ПРИМЕЧАНИЕ: Это псевдокод для иллюстрации идеи.
 * Реальная реализация будет использовать @c4c/workflow API.
 */

import { workflow, step } from '@c4c/workflow';
import { z } from 'zod';

// Шаг 1: Получить детали задачи
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

// Шаг 2: Отправить уведомление через App B (после интеграции!)
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

// Собираем workflow
export const notifyOnTaskCreated = workflow('notify-on-task-created')
  .step(getTaskDetails)
  .step(sendNotification)
  .commit();

/**
 * Как это работает:
 * 
 * 1. Триггер tasks.trigger.created срабатывает при создании задачи
 * 2. Workflow получает taskId из trigger data
 * 3. Шаг 1 вызывает tasks.get (локальная процедура App A)
 * 4. Шаг 2 вызывает notification-service.notifications.send (из App B!)
 * 5. App B получает запрос и отправляет уведомление
 */

// Альтернативный вариант (псевдокод):
/*
export const notifyOnTaskCreatedV2 = {
  id: 'notify-on-task-created-v2',
  name: 'Send notification when task is created',
  
  trigger: {
    provider: 'task-manager',
    triggerProcedure: 'tasks.trigger.created',
    eventType: 'task.created',
  },
  
  nodes: [
    {
      id: 'start',
      type: 'trigger',
      procedureName: 'tasks.trigger.created',
      next: 'get-task',
    },
    {
      id: 'get-task',
      type: 'procedure',
      procedureName: 'tasks.get',
      next: 'send-notification',
    },
    {
      id: 'send-notification',
      type: 'procedure',
      procedureName: 'notification-service.notifications.send', // ← Из App B!
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
