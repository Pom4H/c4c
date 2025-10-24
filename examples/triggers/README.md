# Trigger Examples

This example demonstrates how to use generated procedures/triggers to handle events in workflows.

## Structure

```
src/
├── handlers/
│   ├── telegram-handler.ts        # Telegram event handlers
│   └── google-calendar-handler.ts # Google Calendar event handlers
├── workflows/
│   ├── telegram-bot-workflow.ts   # Workflow for Telegram bot
│   └── google-calendar-workflow.ts # Workflow for Google Calendar
└── server.ts                       # Server setup and startup
```

## Key Concepts

### 1. Importing schemas from generated files

```typescript
// Import JSON schemas from generated/telegram/schemas.gen.ts
import * as TelegramSchemas from '../../generated/telegram/schemas.gen.js';

// Use them to create Zod schemas
const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z.object({...}),
  // ...
});

// Get TypeScript types
type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;
```

### 2. Creating event handlers

```typescript
// Handler receives event and returns result
export const handleTelegramMessage = defineProcedure({
  contract: handleTelegramMessageContract,
  handler: async (input, context) => {
    const { update } = input;
    
    // Handle different message types
    if (update.message?.text.startsWith('/start')) {
      return {
        reply: 'Hello! 👋',
        shouldReply: true,
      };
    }
    
    // ...
  },
});
```

### 3. Event Router

```typescript
// Determines event type for further processing
export const routeTelegramEvent = defineProcedure({
  contract: routeTelegramEventContract,
  handler: async (input, context) => {
    if (input.update.message) {
      return { eventType: 'message', shouldProcess: true };
    }
    if (input.update.callback_query) {
      return { eventType: 'callback_query', shouldProcess: true };
    }
    // ...
  },
});
```

### 4. Workflow with Trigger

```typescript
export const telegramBotWorkflow: WorkflowDefinition = {
  trigger: {
    type: 'webhook',
    config: {
      procedure: 'telegram.post.get.updates', // Generated trigger
      provider: 'telegram',
    },
  },
  steps: [
    {
      id: 'route-event',
      procedure: 'telegram.route.event', // Our router
      input: {
        update: '{{ trigger.data }}', // Data from trigger
      },
    },
    {
      id: 'handle-message',
      procedure: 'telegram.handle.message', // Our handler
      condition: "{{ steps['route-event'].output.eventType === 'message' }}",
      input: {
        update: '{{ trigger.data }}',
      },
    },
    {
      id: 'send-reply',
      procedure: 'telegram.post.send.message', // Generated procedure
      condition: "{{ steps['handle-message'].output.shouldReply === true }}",
      input: {
        chat_id: '{{ trigger.data.message.chat.id }}',
        text: "{{ steps['handle-message'].output.reply }}",
      },
    },
  ],
};
```

## Running

### 1. Install dependencies

```bash
pnpm install
```

### 2. Generate procedures for APIs

```bash
# Telegram
c4c integrate https://api.apis.guru/v2/specs/telegram.org/5.0.0/openapi.json --name telegram

# Google Calendar
c4c integrate https://raw.githubusercontent.com/Pom4H/openapi-ts/main/examples/openapi-ts-trigger/google-calendar-api.json --name google-calendar
```

### 3. Configure environment variables

```bash
export TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
export GOOGLE_CALENDAR_TOKEN="your_google_token"
export TELEGRAM_ADMIN_CHAT_ID="your_chat_id"
```

### 4. Start the server

```bash
pnpm start
# or for development with hot reload
pnpm dev
```

## Testing

### Get list of triggers

```bash
curl http://localhost:3000/webhooks/triggers | jq
```

### Call trigger directly (for testing)

```bash
# Send test message to Telegram bot
curl -X POST http://localhost:3000/webhooks/triggers/telegram.post.send.message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN" \
  -d '{
    "chat_id": 123456789,
    "text": "Test message from c4c!"
  }'
```

### Simulate webhook from Telegram

```bash
curl -X POST http://localhost:3000/webhooks/telegram \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123456789,
    "message": {
      "message_id": 1,
      "from": {
        "id": 123456789,
        "is_bot": false,
        "first_name": "Test",
        "username": "testuser"
      },
      "chat": {
        "id": 123456789,
        "type": "private",
        "first_name": "Test"
      },
      "date": 1234567890,
      "text": "/start"
    }
  }'
```

### Simulate webhook from Google Calendar

```bash
curl -X POST http://localhost:3000/webhooks/google-calendar \
  -H "Content-Type: application/json" \
  -H "X-Goog-Channel-ID: channel-123" \
  -H "X-Goog-Resource-State: update" \
  -d '{
    "kind": "api#channel",
    "id": "channel-123",
    "resourceId": "resource-456",
    "resourceUri": "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    "channelId": "channel-123",
    "resourceState": "update"
  }'
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│           External API (Telegram, Google)       │
│                  ↓ webhook event                │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│         POST /webhooks/:provider                │
│         (WebhookRegistry dispatcher)            │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│              Workflow Engine                    │
│  ┌──────────────────────────────────────────┐  │
│  │  1. Route Event (determine type)         │  │
│  │  2. Handle Event (process)               │  │
│  │  3. Execute Action (perform action)      │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│    Generated Procedures (Telegram API calls)    │
│         - telegram.post.send.message            │
│         - telegram.post.answer.callback.query   │
└─────────────────────────────────────────────────┘
```

## Benefits of this Approach

1. **Full type safety** - TypeScript types from schemas
2. **Reusability** - handlers can be used in different workflows
3. **Testability** - each handler can be tested separately
4. **Extensibility** - easy to add new event types
5. **Composition** - combine different APIs in one workflow

## Example Scenarios

### Telegram → Google Calendar

```typescript
// Create calendar event from Telegram command
steps: [
  {
    id: 'parse-command',
    procedure: 'telegram.parse.create.event',
    input: { message: '{{ trigger.data.message.text }}' },
  },
  {
    id: 'create-event',
    procedure: 'google-calendar.calendar.events.insert',
    input: {
      calendarId: 'primary',
      summary: '{{ steps.parse-command.output.title }}',
      start: { dateTime: '{{ steps.parse-command.output.startTime }}' },
      end: { dateTime: '{{ steps.parse-command.output.endTime }}' },
    },
  },
  {
    id: 'confirm',
    procedure: 'telegram.post.send.message',
    input: {
      chat_id: '{{ trigger.data.message.chat.id }}',
      text: 'Event created! ✅',
    },
  },
]
```

### Google Calendar → Telegram Notification

```typescript
// Notify in Telegram about new event
steps: [
  {
    id: 'fetch-event',
    procedure: 'google-calendar.calendar.events.get',
    input: { /* ... */ },
  },
  {
    id: 'notify',
    procedure: 'telegram.post.send.message',
    input: {
      chat_id: '{{ env.ADMIN_CHAT_ID }}',
      text: 'New event: {{ steps.fetch-event.output.summary }}',
    },
  },
]
```
