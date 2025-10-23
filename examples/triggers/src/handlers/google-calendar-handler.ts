/**
 * Google Calendar Event Handler
 * 
 * Демонстрирует обработку событий от Google Calendar API
 */

import { defineContract, defineProcedure } from '@c4c/core';
import { z } from 'zod';

// ==========================================
// 1. СХЕМЫ СОБЫТИЙ GOOGLE CALENDAR
// ==========================================

/**
 * Google Calendar Notification
 * Приходит когда происходит изменение в календаре
 */
const GoogleCalendarNotificationSchema = z.object({
  kind: z.literal('api#channel'),
  id: z.string(), // Channel ID
  resourceId: z.string(), // Resource ID
  resourceUri: z.string(), // Resource URI
  token: z.string().optional(), // Your verification token
  expiration: z.string().optional(), // Expiration time (Unix timestamp in milliseconds)
  
  // Headers from the notification
  channelId: z.string(),
  channelExpiration: z.string().optional(),
  resourceState: z.enum([
    'sync', // Initial sync message
    'exists', // Resource exists
    'not_exists', // Resource deleted
    'update', // Resource updated
  ]),
  messageNumber: z.number().optional(),
  changed: z.string().optional(), // What changed (e.g., "content", "parents")
});

/**
 * Google Calendar Event
 * Структура события календаря
 */
const GoogleCalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional(),
  }),
  end: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional(),
  }),
  attendees: z.array(z.object({
    email: z.string(),
    displayName: z.string().optional(),
    responseStatus: z.enum(['needsAction', 'declined', 'tentative', 'accepted']).optional(),
  })).optional(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']).optional(),
  htmlLink: z.string().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
});

type GoogleCalendarNotification = z.infer<typeof GoogleCalendarNotificationSchema>;
type GoogleCalendarEvent = z.infer<typeof GoogleCalendarEventSchema>;

// ==========================================
// 2. ПРОЦЕДУРА ДЛЯ РОУТИНГА СОБЫТИЙ КАЛЕНДАРЯ
// ==========================================

export const routeCalendarEventContract = defineContract({
  name: 'google.calendar.route.event',
  description: 'Route Google Calendar notification to appropriate handler',
  input: z.object({
    notification: GoogleCalendarNotificationSchema,
  }),
  output: z.object({
    eventType: z.enum(['sync', 'created', 'updated', 'deleted', 'exists']),
    shouldProcess: z.boolean(),
    shouldFetchDetails: z.boolean(),
    calendarId: z.string().optional(),
    eventId: z.string().optional(),
  }),
  metadata: {
    exposure: 'internal' as const,
    roles: ['workflow-node'],
    tags: ['google-calendar', 'router'],
  },
});

export const routeCalendarEvent = defineProcedure({
  contract: routeCalendarEventContract,
  handler: async (input, context) => {
    const { notification } = input;
    
    console.log(`[Google Calendar] Notification: ${notification.resourceState}`);
    
    // Sync message - initial confirmation
    if (notification.resourceState === 'sync') {
      return {
        eventType: 'sync',
        shouldProcess: false,
        shouldFetchDetails: false,
      };
    }
    
    // Resource exists (no changes)
    if (notification.resourceState === 'exists') {
      return {
        eventType: 'exists',
        shouldProcess: false,
        shouldFetchDetails: false,
      };
    }
    
    // Resource deleted
    if (notification.resourceState === 'not_exists') {
      return {
        eventType: 'deleted',
        shouldProcess: true,
        shouldFetchDetails: false,
        // Extract IDs from resourceUri if available
      };
    }
    
    // Resource updated
    if (notification.resourceState === 'update') {
      const changed = notification.changed || '';
      
      // Determine if it's creation or update based on changed field
      const isCreation = changed.includes('created');
      
      return {
        eventType: isCreation ? 'created' : 'updated',
        shouldProcess: true,
        shouldFetchDetails: true, // Need to fetch full event details
      };
    }
    
    return {
      eventType: 'exists',
      shouldProcess: false,
      shouldFetchDetails: false,
    };
  },
});

// ==========================================
// 3. ОБРАБОТЧИК СОЗДАНИЯ СОБЫТИЯ
// ==========================================

export const handleEventCreatedContract = defineContract({
  name: 'google.calendar.handle.event.created',
  description: 'Handle new calendar event creation',
  input: z.object({
    event: GoogleCalendarEventSchema,
    calendarId: z.string(),
  }),
  output: z.object({
    action: z.string(),
    shouldNotify: z.boolean(),
    message: z.string().optional(),
    recipients: z.array(z.string()).optional(),
  }),
  metadata: {
    exposure: 'internal' as const,
    roles: ['workflow-node'],
    tags: ['google-calendar', 'handler', 'creation'],
  },
});

export const handleEventCreated = defineProcedure({
  contract: handleEventCreatedContract,
  handler: async (input, context) => {
    const { event, calendarId } = input;
    
    console.log(`[Calendar] New event created: ${event.summary}`);
    console.log(`  Start: ${event.start.dateTime || event.start.date}`);
    console.log(`  Location: ${event.location || 'N/A'}`);
    
    // Определяем, нужно ли уведомлять
    const shouldNotify = !!(event.attendees && event.attendees.length > 0);
    
    if (shouldNotify) {
      const recipients = event.attendees?.map(a => a.email) || [];
      
      return {
        action: 'notify_attendees',
        shouldNotify: true,
        message: `Новое событие: ${event.summary}\n` +
                 `Начало: ${event.start.dateTime || event.start.date}\n` +
                 `Место: ${event.location || 'Не указано'}`,
        recipients,
      };
    }
    
    return {
      action: 'log_only',
      shouldNotify: false,
    };
  },
});

// ==========================================
// 4. ОБРАБОТЧИК ИЗМЕНЕНИЯ СОБЫТИЯ
// ==========================================

export const handleEventUpdatedContract = defineContract({
  name: 'google.calendar.handle.event.updated',
  description: 'Handle calendar event update',
  input: z.object({
    event: GoogleCalendarEventSchema,
    calendarId: z.string(),
    previousEvent: GoogleCalendarEventSchema.optional(), // If available
  }),
  output: z.object({
    changes: z.array(z.string()),
    shouldNotify: z.boolean(),
    message: z.string().optional(),
  }),
  metadata: {
    exposure: 'internal' as const,
    roles: ['workflow-node'],
    tags: ['google-calendar', 'handler', 'update'],
  },
});

export const handleEventUpdated = defineProcedure({
  contract: handleEventUpdatedContract,
  handler: async (input, context) => {
    const { event, previousEvent } = input;
    
    const changes: string[] = [];
    
    // Detect changes
    if (previousEvent) {
      if (event.summary !== previousEvent.summary) {
        changes.push(`Название изменено: "${previousEvent.summary}" → "${event.summary}"`);
      }
      
      if (event.start.dateTime !== previousEvent.start.dateTime) {
        changes.push(`Время начала изменено`);
      }
      
      if (event.location !== previousEvent.location) {
        changes.push(`Место изменено: ${previousEvent.location || 'N/A'} → ${event.location || 'N/A'}`);
      }
    } else {
      changes.push('Событие обновлено (детали изменений недоступны)');
    }
    
    console.log(`[Calendar] Event updated: ${event.summary}`);
    for (const change of changes) {
      console.log(`  - ${change}`);
    }
    
    const shouldNotify = changes.length > 0 && event.attendees && event.attendees.length > 0;
    
    if (shouldNotify) {
      return {
        changes,
        shouldNotify: true,
        message: `Событие "${event.summary}" изменено:\n${changes.join('\n')}`,
      };
    }
    
    return {
      changes,
      shouldNotify: false,
    };
  },
});

// ==========================================
// 5. ОБРАБОТЧИК УДАЛЕНИЯ СОБЫТИЯ
// ==========================================

export const handleEventDeletedContract = defineContract({
  name: 'google.calendar.handle.event.deleted',
  description: 'Handle calendar event deletion',
  input: z.object({
    eventId: z.string(),
    calendarId: z.string(),
    eventSummary: z.string().optional(), // If we cached it
  }),
  output: z.object({
    action: z.string(),
    shouldNotify: z.boolean(),
    message: z.string().optional(),
  }),
  metadata: {
    exposure: 'internal' as const,
    roles: ['workflow-node'],
    tags: ['google-calendar', 'handler', 'deletion'],
  },
});

export const handleEventDeleted = defineProcedure({
  contract: handleEventDeletedContract,
  handler: async (input, context) => {
    const { eventId, eventSummary } = input;
    
    console.log(`[Calendar] Event deleted: ${eventSummary || eventId}`);
    
    return {
      action: 'log_deletion',
      shouldNotify: !!eventSummary,
      message: eventSummary 
        ? `Событие "${eventSummary}" было удалено`
        : `Событие ${eventId} было удалено`,
    };
  },
});

// ==========================================
// 6. ЭКСПОРТ ВСЕХ ПРОЦЕДУР
// ==========================================

export const GoogleCalendarHandlers = [
  routeCalendarEvent,
  handleEventCreated,
  handleEventUpdated,
  handleEventDeleted,
];
