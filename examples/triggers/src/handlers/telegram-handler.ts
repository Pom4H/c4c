/**
 * Telegram Bot Event Handler
 * 
 * Демонстрирует как обрабатывать события от Telegram используя
 * типы из сгенерированных процедур
 */

import { defineContract, defineProcedure } from '@c4c/core';
import { z } from 'zod';

// ==========================================
// 1. ИМПОРТИРУЕМ ТИПЫ ИЗ СГЕНЕРИРОВАННЫХ ПРОЦЕДУР
// ==========================================

// Импортируем схемы из generated/telegram/schemas.gen.ts
import * as TelegramSchemas from '../../../generated/telegram/schemas.gen.js';

// ==========================================
// 2. ОПРЕДЕЛЯЕМ СХЕМЫ СОБЫТИЙ
// ==========================================

/**
 * Telegram Update - основная схема события от Telegram
 * Используем JSON Schema из сгенерированного файла
 */
const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z.object({
    message_id: z.number(),
    from: z.object({
      id: z.number(),
      is_bot: z.boolean().optional(),
      first_name: z.string(),
      last_name: z.string().optional(),
      username: z.string().optional(),
    }),
    chat: z.object({
      id: z.number(),
      type: z.enum(['private', 'group', 'supergroup', 'channel']),
      title: z.string().optional(),
      username: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
    }),
    date: z.number(),
    text: z.string().optional(),
    photo: z.array(z.any()).optional(),
    document: z.any().optional(),
  }).optional(),
  edited_message: z.any().optional(),
  channel_post: z.any().optional(),
  callback_query: z.object({
    id: z.string(),
    from: z.any(),
    message: z.any().optional(),
    data: z.string().optional(),
  }).optional(),
});

// TypeScript типы из схем
type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;
type TelegramMessage = NonNullable<TelegramUpdate['message']>;
type TelegramCallbackQuery = NonNullable<TelegramUpdate['callback_query']>;

// ==========================================
// 3. ПРОЦЕДУРА ДЛЯ ОБРАБОТКИ ТЕКСТОВЫХ СООБЩЕНИЙ
// ==========================================

export const handleTelegramMessageContract = defineContract({
  name: 'telegram.handle.message',
  description: 'Handle incoming Telegram text message',
  input: z.object({
    update: TelegramUpdateSchema,
  }),
  output: z.object({
    reply: z.string(),
    shouldReply: z.boolean(),
    actions: z.array(z.string()).optional(),
  }),
  metadata: {
    exposure: 'internal' as const,
    roles: ['workflow-node'],
    tags: ['telegram', 'handler'],
  },
});

export const handleTelegramMessage = defineProcedure({
  contract: handleTelegramMessageContract,
  handler: async (input, context) => {
    const { update } = input;
    
    // Проверяем, что это текстовое сообщение
    if (!update.message?.text) {
      return {
        reply: '',
        shouldReply: false,
      };
    }
    
    const message = update.message;
    const text = message.text.toLowerCase();
    
    console.log(`[Telegram] Received message from ${message.from.first_name}: ${message.text}`);
    
    // Обработка команд
    if (text.startsWith('/start')) {
      return {
        reply: `Привет, ${message.from.first_name}! 👋\n\nЯ бот на c4c framework.\nИспользуй /help для списка команд.`,
        shouldReply: true,
        actions: ['log_user', 'send_welcome'],
      };
    }
    
    if (text.startsWith('/help')) {
      return {
        reply: `📚 Доступные команды:\n\n` +
               `/start - Начать работу\n` +
               `/help - Эта справка\n` +
               `/status - Проверить статус\n` +
               `/subscribe - Подписаться на уведомления`,
        shouldReply: true,
      };
    }
    
    if (text.startsWith('/status')) {
      return {
        reply: `✅ Бот работает нормально!\n\nВремя: ${new Date().toISOString()}`,
        shouldReply: true,
      };
    }
    
    // Обработка обычного текста
    if (text.includes('привет') || text.includes('hello')) {
      return {
        reply: `Привет! Как дела?`,
        shouldReply: true,
      };
    }
    
    // Эхо для остального
    return {
      reply: `Вы сказали: "${message.text}"`,
      shouldReply: true,
      actions: ['echo'],
    };
  },
});

// ==========================================
// 4. ПРОЦЕДУРА ДЛЯ ОБРАБОТКИ CALLBACK QUERY
// ==========================================

export const handleTelegramCallbackContract = defineContract({
  name: 'telegram.handle.callback',
  description: 'Handle Telegram callback query from inline keyboard',
  input: z.object({
    update: TelegramUpdateSchema,
  }),
  output: z.object({
    answer: z.string(),
    showAlert: z.boolean(),
    editMessage: z.boolean(),
    newText: z.string().optional(),
  }),
  metadata: {
    exposure: 'internal' as const,
    roles: ['workflow-node'],
    tags: ['telegram', 'handler', 'callback'],
  },
});

export const handleTelegramCallback = defineProcedure({
  contract: handleTelegramCallbackContract,
  handler: async (input, context) => {
    const { update } = input;
    
    if (!update.callback_query) {
      return {
        answer: '',
        showAlert: false,
        editMessage: false,
      };
    }
    
    const callback = update.callback_query;
    const data = callback.data || '';
    
    console.log(`[Telegram] Callback query: ${data} from user ${callback.from.id}`);
    
    // Обработка разных callback data
    if (data === 'subscribe') {
      return {
        answer: 'Вы подписаны на уведомления! ✅',
        showAlert: true,
        editMessage: true,
        newText: 'Подписка активирована! Вы будете получать уведомления.',
      };
    }
    
    if (data === 'unsubscribe') {
      return {
        answer: 'Подписка отменена',
        showAlert: false,
        editMessage: true,
        newText: 'Подписка отменена. Вы больше не будете получать уведомления.',
      };
    }
    
    if (data.startsWith('action_')) {
      const action = data.replace('action_', '');
      return {
        answer: `Выполнено: ${action}`,
        showAlert: false,
        editMessage: false,
      };
    }
    
    return {
      answer: 'Команда обработана',
      showAlert: false,
      editMessage: false,
    };
  },
});

// ==========================================
// 5. РОУТЕР СОБЫТИЙ - ОПРЕДЕЛЯЕТ ТИП СОБЫТИЯ
// ==========================================

export const routeTelegramEventContract = defineContract({
  name: 'telegram.route.event',
  description: 'Route Telegram update to appropriate handler',
  input: z.object({
    update: TelegramUpdateSchema,
  }),
  output: z.object({
    eventType: z.enum([
      'message',
      'edited_message',
      'callback_query',
      'channel_post',
      'unknown',
    ]),
    shouldProcess: z.boolean(),
    metadata: z.record(z.unknown()).optional(),
  }),
  metadata: {
    exposure: 'internal' as const,
    roles: ['workflow-node'],
    tags: ['telegram', 'router'],
  },
});

export const routeTelegramEvent = defineProcedure({
  contract: routeTelegramEventContract,
  handler: async (input, context) => {
    const { update } = input;
    
    // Определяем тип события
    if (update.message) {
      return {
        eventType: 'message',
        shouldProcess: true,
        metadata: {
          chatId: update.message.chat.id,
          userId: update.message.from.id,
          hasText: !!update.message.text,
          hasPhoto: !!update.message.photo,
        },
      };
    }
    
    if (update.edited_message) {
      return {
        eventType: 'edited_message',
        shouldProcess: true,
        metadata: {
          messageId: update.edited_message.message_id,
        },
      };
    }
    
    if (update.callback_query) {
      return {
        eventType: 'callback_query',
        shouldProcess: true,
        metadata: {
          callbackData: update.callback_query.data,
          userId: update.callback_query.from.id,
        },
      };
    }
    
    if (update.channel_post) {
      return {
        eventType: 'channel_post',
        shouldProcess: false, // Не обрабатываем посты в каналах
      };
    }
    
    return {
      eventType: 'unknown',
      shouldProcess: false,
    };
  },
});

// ==========================================
// 6. ЭКСПОРТ ВСЕХ ПРОЦЕДУР
// ==========================================

export const TelegramHandlers = [
  handleTelegramMessage,
  handleTelegramCallback,
  routeTelegramEvent,
];
