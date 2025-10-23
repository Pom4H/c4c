/**
 * Workflow: Notify on Task Created
 * 
 * После интеграции с App B (notification-service),
 * этот workflow автоматически отправляет уведомление при создании задачи
 */

import type { WorkflowDefinition } from '@c4c/workflow';

export const notifyOnTaskCreated: WorkflowDefinition = {
  id: 'notify-on-task-created',
  name: 'Send notification when task is created',
  description: 'Integrates with notification service to send alerts',
  
  // Триггер: новая задача создана
  trigger: {
    type: 'webhook',
    config: {
      procedure: 'tasks.trigger.created',
      provider: 'task-manager',
    },
  },
  
  steps: [
    // Шаг 1: Получить детали задачи
    {
      id: 'get-task',
      name: 'Get task details',
      procedure: 'tasks.get',
      input: {
        id: '{{ trigger.data.id }}',
      },
    },
    
    // Шаг 2: Отправить уведомление через App B (после интеграции!)
    // После выполнения: c4c integrate http://localhost:3002/openapi.json --name notification-service
    // Станет доступна процедура: notification-service.notifications.send
    {
      id: 'send-notification',
      name: 'Send notification via Notification Service',
      procedure: 'notification-service.notifications.send', // ← Процедура из App B!
      input: {
        message: '🆕 New task created: {{ steps.get-task.output.title }}',
        channel: 'push',
        priority: '{{ steps.get-task.output.priority === "high" ? "urgent" : "normal" }}',
        metadata: {
          taskId: '{{ steps.get-task.output.id }}',
          status: '{{ steps.get-task.output.status }}',
          source: 'task-manager',
        },
      },
    },
    
    // Шаг 3: Логирование
    {
      id: 'log',
      name: 'Log notification sent',
      procedure: 'system.log',
      input: {
        level: 'info',
        message: 'Notification sent for task creation',
        data: {
          taskId: '{{ steps.get-task.output.id }}',
          notificationId: '{{ steps.send-notification.output.id }}',
        },
      },
    },
  ],
};

// Пример использования ПОСЛЕ интеграции:
// 1. Запустите App B: cd app-b && pnpm dev
// 2. Интегрируйте App B в App A:
//    cd app-a && c4c integrate http://localhost:3002/openapi.json --name notification-service
// 3. Теперь процедура 'notification-service.notifications.send' доступна!
// 4. Создайте задачу через API App A
// 5. Workflow автоматически отправит уведомление через App B
