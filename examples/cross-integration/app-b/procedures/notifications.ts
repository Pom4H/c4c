/**
 * Notification Service Procedures
 * 
 * Send and manage notifications with webhook triggers
 */

import type { Procedure } from '@c4c/core';
import { z } from 'zod';

// ==========================================
// SCHEMAS
// ==========================================

const NotificationSchema = z.object({
  id: z.string(),
  message: z.string(),
  recipient: z.string().optional(),
  channel: z.enum(['email', 'sms', 'push', 'webhook']).default('push'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  status: z.enum(['pending', 'sent', 'failed']),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sentAt: z.string().optional(),
  createdAt: z.string(),
});

type Notification = z.infer<typeof NotificationSchema>;

// In-memory storage
const notifications = new Map<string, Notification>();
const subscriptions = new Map<string, string[]>(); // topic -> webhooks

// ==========================================
// SEND NOTIFICATION
// ==========================================

const sendNotificationInput = z.object({
  message: z.string().min(1),
  recipient: z.string().optional(),
  channel: z.enum(['email', 'sms', 'push', 'webhook']).default('push'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const sendNotification: Procedure = {
  contract: {
    name: 'notifications.send',
    description: 'Send a notification',
    input: sendNotificationInput,
    output: NotificationSchema,
    metadata: {
      exposure: 'external',
      roles: ['api-endpoint', 'workflow-node', 'sdk-client'],
      tags: ['notifications', 'send'],
    },
  },
  handler: async (input) => {
    const data = input as z.infer<typeof sendNotificationInput>;
    const now = new Date().toISOString();
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const notification: Notification = {
      id,
      message: data.message,
      recipient: data.recipient,
      channel: data.channel || 'push',
      priority: data.priority || 'normal',
      status: 'sent',
      metadata: data.metadata,
      sentAt: now,
      createdAt: now,
    };
    
    notifications.set(id, notification);
    
    console.log(`[Notifications] 🔥 CROSS-APP EVENT RECEIVED! 🔥`);
    console.log(`  Message: ${notification.message}`);
    console.log(`  Channel: ${notification.channel}`);
    console.log(`  Priority: ${notification.priority}`);
    console.log(`  From: ${data.metadata?.source || 'unknown'}`);
    console.log(`  Notification ID: ${id}`);
    
    return notification;
  },
};

// ==========================================
// LIST NOTIFICATIONS
// ==========================================

const listNotificationsInput = z.object({
  recipient: z.string().optional(),
  status: z.enum(['pending', 'sent', 'failed']).optional(),
  limit: z.number().optional(),
});

export const listNotifications: Procedure = {
  contract: {
    name: 'notifications.list',
    description: 'List all notifications',
    input: listNotificationsInput,
    output: z.object({
      notifications: z.array(NotificationSchema),
      total: z.number(),
    }),
    metadata: {
      exposure: 'external',
      roles: ['api-endpoint', 'workflow-node', 'sdk-client'],
      tags: ['notifications', 'list'],
    },
  },
  handler: async (input) => {
    const data = input as z.infer<typeof listNotificationsInput>;
    let filtered = Array.from(notifications.values());
    
    if (data.recipient) {
      filtered = filtered.filter(n => n.recipient === data.recipient);
    }
    
    if (data.status) {
      filtered = filtered.filter(n => n.status === data.status);
    }
    
    if (data.limit) {
      filtered = filtered.slice(0, data.limit);
    }
    
    return {
      notifications: filtered,
      total: filtered.length,
    };
  },
};

// ==========================================
// SUBSCRIBE TO NOTIFICATIONS
// ==========================================

const subscribeNotificationsInput = z.object({
  topic: z.string(),
  webhookUrl: z.string().url(),
});

export const subscribeNotifications: Procedure = {
  contract: {
    name: 'notifications.subscribe',
    description: 'Subscribe to notifications on a topic',
    input: subscribeNotificationsInput,
    output: z.object({
      success: z.boolean(),
      subscriptionId: z.string(),
      topic: z.string(),
    }),
    metadata: {
      exposure: 'external',
      roles: ['api-endpoint', 'workflow-node', 'sdk-client'],
      tags: ['notifications', 'subscribe'],
    },
  },
  handler: async (input) => {
    const data = input as z.infer<typeof subscribeNotificationsInput>;
    const existing = subscriptions.get(data.topic) || [];
    
    if (!existing.includes(data.webhookUrl)) {
      existing.push(data.webhookUrl);
      subscriptions.set(data.topic, existing);
    }
    
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[Notifications] New subscription:`);
    console.log(`  Topic: ${data.topic}`);
    console.log(`  Webhook: ${data.webhookUrl}`);
    
    return {
      success: true,
      subscriptionId,
      topic: data.topic,
    };
  },
};

// ==========================================
// WEBHOOKS / TRIGGERS
// ==========================================

/**
 * Notification Sent Trigger
 * Fires when a notification is sent
 */
export const notificationSentTrigger: Procedure = {
  contract: {
    name: 'notifications.trigger.sent',
    description: 'Webhook trigger that fires when a notification is sent',
    input: z.object({
      webhookUrl: z.string().url().optional(),
      filter: z.object({
        channel: z.enum(['email', 'sms', 'push', 'webhook']).optional(),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
      }).optional(),
    }),
    output: NotificationSchema,
    metadata: {
      exposure: 'external',
      type: 'trigger',
      roles: ['trigger'],
      trigger: {
        type: 'webhook',
        eventTypes: ['sent'],
      },
      provider: 'notifications',
      tags: ['notifications', 'webhook', 'trigger'],
    },
  },
  handler: async () => {
    throw new Error('This is a trigger procedure - it should not be called directly');
  },
};
