/**
 * Telegram Bot Event Handler
 * 
 * Demonstrates how to handle Telegram events using
 * types from generated procedures
 */

import { defineContract, defineProcedure } from '@c4c/core';
import { z } from 'zod';

// ==========================================
// 1. IMPORT TYPES FROM GENERATED PROCEDURES
// ==========================================

// Import schemas from generated/telegram/schemas.gen.ts
import * as TelegramSchemas from '../../../generated/telegram/schemas.gen.js';

// ==========================================
// 2. DEFINE EVENT SCHEMAS
// ==========================================

/**
 * Telegram Update - main event schema from Telegram
 * Using JSON Schema from generated file
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

// TypeScript types from schemas
type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;
type TelegramMessage = NonNullable<TelegramUpdate['message']>;
type TelegramCallbackQuery = NonNullable<TelegramUpdate['callback_query']>;

// ==========================================
// 3. PROCEDURE FOR HANDLING TEXT MESSAGES
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
    
    // Check if this is a text message
    if (!update.message?.text) {
      return {
        reply: '',
        shouldReply: false,
      };
    }
    
    const message = update.message;
    const text = message.text.toLowerCase();
    
    console.log(`[Telegram] Received message from ${message.from.first_name}: ${message.text}`);
    
    // Handle commands
    if (text.startsWith('/start')) {
      return {
        reply: `Hello, ${message.from.first_name}! 👋\n\nI'm a bot built with c4c framework.\nUse /help to see available commands.`,
        shouldReply: true,
        actions: ['log_user', 'send_welcome'],
      };
    }
    
    if (text.startsWith('/help')) {
      return {
        reply: `📚 Available commands:\n\n` +
               `/start - Start using the bot\n` +
               `/help - Show this help\n` +
               `/status - Check bot status\n` +
               `/subscribe - Subscribe to notifications`,
        shouldReply: true,
      };
    }
    
    if (text.startsWith('/status')) {
      return {
        reply: `✅ Bot is running!\n\nTime: ${new Date().toISOString()}`,
        shouldReply: true,
      };
    }
    
    // Handle regular text
    if (text.includes('hello') || text.includes('hi')) {
      return {
        reply: `Hello! How are you?`,
        shouldReply: true,
      };
    }
    
    // Echo for everything else
    return {
      reply: `You said: "${message.text}"`,
      shouldReply: true,
      actions: ['echo'],
    };
  },
});

// ==========================================
// 4. PROCEDURE FOR HANDLING CALLBACK QUERY
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
    
    // Handle different callback data
    if (data === 'subscribe') {
      return {
        answer: 'You are subscribed to notifications! ✅',
        showAlert: true,
        editMessage: true,
        newText: 'Subscription activated! You will receive notifications.',
      };
    }
    
    if (data === 'unsubscribe') {
      return {
        answer: 'Subscription cancelled',
        showAlert: false,
        editMessage: true,
        newText: 'Subscription cancelled. You will no longer receive notifications.',
      };
    }
    
    if (data.startsWith('action_')) {
      const action = data.replace('action_', '');
      return {
        answer: `Executed: ${action}`,
        showAlert: false,
        editMessage: false,
      };
    }
    
    return {
      answer: 'Command processed',
      showAlert: false,
      editMessage: false,
    };
  },
});

// ==========================================
// 5. EVENT ROUTER - DETERMINES EVENT TYPE
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
    
    // Determine event type
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
        shouldProcess: false, // Don't process channel posts
      };
    }
    
    return {
      eventType: 'unknown',
      shouldProcess: false,
    };
  },
});

// ==========================================
// 6. EXPORT ALL PROCEDURES
// ==========================================

export const TelegramHandlers = [
  handleTelegramMessage,
  handleTelegramCallback,
  routeTelegramEvent,
];
