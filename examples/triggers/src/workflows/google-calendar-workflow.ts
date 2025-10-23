/**
 * Google Calendar Workflow
 * 
 * Обрабатывает изменения в Google Calendar и отправляет уведомления
 */

import type { WorkflowDefinition } from '@c4c/workflow';

export const googleCalendarWorkflow: WorkflowDefinition = {
  id: 'google-calendar-sync',
  name: 'Google Calendar Event Sync',
  description: 'Syncs calendar events and sends notifications',
  
  // ==========================================
  // TRIGGER: Watch от Google Calendar
  // ==========================================
  trigger: {
    type: 'webhook' as const,
    config: {
      // Используем сгенерированную процедуру для watch
      procedure: 'google-calendar.calendar.events.watch',
      provider: 'google-calendar',
      
      // Параметры для регистрации watch
      initialSetup: {
        calendarId: 'primary',
        channel: {
          id: '{{ generateUUID() }}',
          type: 'web_hook',
          address: 'https://your-domain.com/webhooks/google-calendar',
          expiration: '{{ timestamp + 604800000 }}', // 7 days
        },
      },
    },
  },
  
  steps: [
    // ==========================================
    // ШАГ 1: Определение типа события
    // ==========================================
    {
      id: 'route-event',
      name: 'Route Calendar Event',
      procedure: 'google.calendar.route.event',
      input: {
        notification: '{{ trigger.data }}',
      },
    },
    
    // ==========================================
    // ШАГ 2: Получение деталей события (если нужно)
    // ==========================================
    {
      id: 'fetch-event-details',
      name: 'Fetch Event Details',
      procedure: 'google-calendar.calendar.events.get',
      condition: "{{ steps['route-event'].output.shouldFetchDetails === true }}",
      input: {
        calendarId: 'primary',
        eventId: "{{ steps['route-event'].output.eventId }}",
      },
    },
    
    // ==========================================
    // ШАГ 3: Обработка создания события
    // ==========================================
    {
      id: 'handle-created',
      name: 'Handle Event Created',
      procedure: 'google.calendar.handle.event.created',
      condition: "{{ steps['route-event'].output.eventType === 'created' }}",
      input: {
        event: "{{ steps['fetch-event-details'].output }}",
        calendarId: 'primary',
      },
    },
    
    // ==========================================
    // ШАГ 4: Обработка обновления события
    // ==========================================
    {
      id: 'handle-updated',
      name: 'Handle Event Updated',
      procedure: 'google.calendar.handle.event.updated',
      condition: "{{ steps['route-event'].output.eventType === 'updated' }}",
      input: {
        event: "{{ steps['fetch-event-details'].output }}",
        calendarId: 'primary',
        // previousEvent можно получить из кэша/БД
      },
    },
    
    // ==========================================
    // ШАГ 5: Обработка удаления события
    // ==========================================
    {
      id: 'handle-deleted',
      name: 'Handle Event Deleted',
      procedure: 'google.calendar.handle.event.deleted',
      condition: "{{ steps['route-event'].output.eventType === 'deleted' }}",
      input: {
        eventId: "{{ steps['route-event'].output.eventId }}",
        calendarId: 'primary',
      },
    },
    
    // ==========================================
    // ШАГ 6: Отправка уведомления в Telegram (если нужно)
    // ==========================================
    {
      id: 'notify-telegram',
      name: 'Send Telegram Notification',
      procedure: 'telegram.post.send.message',
      condition: "{{ (steps['handle-created']?.output?.shouldNotify || steps['handle-updated']?.output?.shouldNotify) === true }}",
      input: {
        chat_id: '{{ env.TELEGRAM_ADMIN_CHAT_ID }}',
        text: "{{ steps['handle-created']?.output?.message || steps['handle-updated']?.output?.message }}",
        parse_mode: 'Markdown',
      },
    },
    
    // ==========================================
    // ШАГ 7: Логирование
    // ==========================================
    {
      id: 'log-event',
      name: 'Log Calendar Event',
      procedure: 'system.log',
      input: {
        level: 'info',
        message: 'Calendar event processed',
        data: {
          eventType: "{{ steps['route-event'].output.eventType }}",
          calendarId: 'primary',
          processed: true,
        },
      },
    },
  ],
};
