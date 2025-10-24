/**
 * Google Calendar Workflow
 * 
 * Handles changes in Google Calendar and sends notifications
 */

import type { WorkflowDefinition } from '@c4c/workflow';

export const googleCalendarWorkflow: WorkflowDefinition = {
  id: 'google-calendar-sync',
  name: 'Google Calendar Event Sync',
  description: 'Syncs calendar events and sends notifications',
  
  // ==========================================
  // TRIGGER: Watch from Google Calendar
  // ==========================================
  trigger: {
    type: 'webhook' as const,
    config: {
      // Use generated procedure for watch
      procedure: 'google-calendar.calendar.events.watch',
      provider: 'google-calendar',
      
      // Parameters for watch registration
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
    // STEP 1: Determine event type
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
    // STEP 2: Fetch event details (if needed)
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
    // STEP 3: Handle event creation
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
    // STEP 4: Handle event update
    // ==========================================
    {
      id: 'handle-updated',
      name: 'Handle Event Updated',
      procedure: 'google.calendar.handle.event.updated',
      condition: "{{ steps['route-event'].output.eventType === 'updated' }}",
      input: {
        event: "{{ steps['fetch-event-details'].output }}",
        calendarId: 'primary',
        // previousEvent can be retrieved from cache/DB
      },
    },
    
    // ==========================================
    // STEP 5: Handle event deletion
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
    // STEP 6: Send Telegram notification (if needed)
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
    // STEP 7: Logging
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
