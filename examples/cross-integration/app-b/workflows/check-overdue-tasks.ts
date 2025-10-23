/**
 * Workflow: Check Overdue Tasks
 * 
 * После интеграции с App A (task-manager),
 * этот workflow периодически проверяет просроченные задачи и отправляет уведомления
 */

import type { WorkflowDefinition } from '@c4c/workflow';

export const checkOverdueTasks: WorkflowDefinition = {
  id: 'check-overdue-tasks',
  name: 'Check for overdue tasks and notify',
  description: 'Periodically checks task manager for overdue tasks',
  
  // Триггер: можно настроить cron schedule
  trigger: {
    type: 'schedule',
    config: {
      schedule: '0 9 * * *', // Каждый день в 9:00
    },
  },
  
  steps: [
    // Шаг 1: Получить все задачи из App A (после интеграции!)
    // После выполнения: c4c integrate http://localhost:3001/openapi.json --name task-manager
    // Станет доступна процедура: task-manager.tasks.list
    {
      id: 'get-tasks',
      name: 'Fetch all tasks from Task Manager',
      procedure: 'task-manager.tasks.list', // ← Процедура из App A!
      input: {
        status: 'in_progress', // Только активные задачи
      },
    },
    
    // Шаг 2: Фильтрация просроченных задач
    {
      id: 'filter-overdue',
      name: 'Filter overdue tasks',
      procedure: 'tasks.filter.overdue', // Локальная процедура для фильтрации
      input: {
        tasks: '{{ steps.get-tasks.output.tasks }}',
        currentDate: '{{ new Date().toISOString() }}',
      },
    },
    
    // Шаг 3: Подсчет просроченных задач
    {
      id: 'count-overdue',
      name: 'Count overdue tasks',
      procedure: 'transform.count',
      input: {
        items: '{{ steps.filter-overdue.output.overdueTasks }}',
      },
    },
    
    // Шаг 4: Отправить уведомление если есть просроченные
    {
      id: 'send-notification',
      name: 'Send overdue tasks notification',
      procedure: 'notifications.send', // Локальная процедура App B
      condition: '{{ steps.count-overdue.output.count > 0 }}',
      input: {
        message: '⚠️ You have {{ steps.count-overdue.output.count }} overdue task(s)!',
        channel: 'email',
        priority: 'high',
        metadata: {
          overdueTasks: '{{ steps.filter-overdue.output.overdueTasks }}',
          source: 'notification-service',
          checkTime: '{{ new Date().toISOString() }}',
        },
      },
    },
    
    // Шаг 5: Для каждой просроченной задачи отправить индивидуальное уведомление
    {
      id: 'notify-each-task',
      name: 'Send notification for each overdue task',
      procedure: 'notifications.send',
      condition: '{{ steps.count-overdue.output.count > 0 }}',
      forEach: '{{ steps.filter-overdue.output.overdueTasks }}',
      input: {
        message: '📋 Task "{{ item.title }}" is overdue! Due: {{ item.dueDate }}',
        channel: 'push',
        priority: 'urgent',
        recipient: '{{ item.assignee }}',
        metadata: {
          taskId: '{{ item.id }}',
          dueDate: '{{ item.dueDate }}',
          daysOverdue: '{{ calculateDaysOverdue(item.dueDate) }}',
        },
      },
    },
  ],
};

// Пример использования ПОСЛЕ интеграции:
// 1. Запустите App A: cd app-a && pnpm dev
// 2. Интегрируйте App A в App B:
//    cd app-b && c4c integrate http://localhost:3001/openapi.json --name task-manager
// 3. Теперь процедура 'task-manager.tasks.list' доступна!
// 4. Создайте несколько задач с прошедшим dueDate в App A
// 5. Запустите workflow вручную или дождитесь cron
// 6. App B получит задачи из App A и отправит уведомления
