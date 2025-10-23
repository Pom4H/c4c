/**
 * Telegram Bot Workflow
 * 
 * Полный пример workflow для обработки событий от Telegram
 */

import type { WorkflowDefinition } from '@c4c/workflow';

export const telegramBotWorkflow: WorkflowDefinition = {
  id: 'telegram-bot',
  name: 'Telegram Bot Message Handler',
  description: 'Handles incoming messages from Telegram bot',
  
  // ==========================================
  // TRIGGER: Webhook от Telegram
  // ==========================================
  trigger: {
    type: 'webhook' as const,
    config: {
      // Используем сгенерированную процедуру для получения updates
      procedure: 'telegram.post.get.updates',
      provider: 'telegram',
      
      // Или webhook endpoint
      // procedure: 'telegram.post.set.webhook',
      // webhookUrl: 'https://your-domain.com/webhooks/telegram',
    },
  },
  
  steps: [
    // ==========================================
    // ШАГ 1: Роутинг события
    // ==========================================
    {
      id: 'route-event',
      name: 'Determine Event Type',
      procedure: 'telegram.route.event',
      input: {
        update: '{{ trigger.data }}',
      },
    },
    
    // ==========================================
    // ШАГ 2: Обработка текстового сообщения
    // ==========================================
    {
      id: 'handle-message',
      name: 'Handle Text Message',
      procedure: 'telegram.handle.message',
      condition: "{{ steps['route-event'].output.eventType === 'message' }}",
      input: {
        update: '{{ trigger.data }}',
      },
    },
    
    // ==========================================
    // ШАГ 3: Отправка ответа
    // ==========================================
    {
      id: 'send-reply',
      name: 'Send Reply Message',
      procedure: 'telegram.post.send.message',
      condition: "{{ steps['handle-message'].output.shouldReply === true }}",
      input: {
        chat_id: '{{ trigger.data.message.chat.id }}',
        text: "{{ steps['handle-message'].output.reply }}",
        parse_mode: 'Markdown',
      },
    },
    
    // ==========================================
    // ШАГ 4: Обработка callback query
    // ==========================================
    {
      id: 'handle-callback',
      name: 'Handle Callback Query',
      procedure: 'telegram.handle.callback',
      condition: "{{ steps['route-event'].output.eventType === 'callback_query' }}",
      input: {
        update: '{{ trigger.data }}',
      },
    },
    
    // ==========================================
    // ШАГ 5: Ответ на callback query
    // ==========================================
    {
      id: 'answer-callback',
      name: 'Answer Callback Query',
      procedure: 'telegram.post.answer.callback.query',
      condition: "{{ steps['handle-callback'] !== undefined }}",
      input: {
        callback_query_id: '{{ trigger.data.callback_query.id }}',
        text: "{{ steps['handle-callback'].output.answer }}",
        show_alert: "{{ steps['handle-callback'].output.showAlert }}",
      },
    },
    
    // ==========================================
    // ШАГ 6: Логирование
    // ==========================================
    {
      id: 'log-event',
      name: 'Log Processed Event',
      procedure: 'system.log',
      input: {
        level: 'info',
        message: 'Telegram event processed',
        data: {
          updateId: '{{ trigger.data.update_id }}',
          eventType: "{{ steps['route-event'].output.eventType }}",
          processed: true,
        },
      },
    },
  ],
};
