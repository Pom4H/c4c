# Integration Example: Telegram Bot API

This document demonstrates the complete workflow of integrating an external API using the new trigger generator.

## Step 1: Run the Integration Command

```bash
c4c integrate https://api.apis.guru/v2/specs/telegram.org/5.0.0/openapi.json
```

**Output:**
```
[c4c] Integrating telegram from https://api.apis.guru/v2/specs/telegram.org/5.0.0/openapi.json
[c4c] Generating SDK and schemas...
⏳ Generating from https://api.apis.guru/v2/specs/telegram.org/5.0.0/openapi.json
🚀 Done! Your output is in /workspace/generated/telegram
[c4c] Generated triggers for telegram at /workspace/generated/telegram
[c4c] Generating procedures...
[c4c] Generated procedures at /workspace/procedures/integrations/telegram/procedures.gen.ts
[c4c] ✓ Successfully integrated telegram
[c4c]   Generated files:
[c4c]   - SDK: /workspace/generated/telegram/sdk.gen.ts
[c4c]   - Schemas: /workspace/generated/telegram/zod.gen.ts
[c4c]   - Procedures: /workspace/procedures/integrations/telegram/procedures.gen.ts

[c4c] Next steps:
[c4c]   1. Import procedures in your code:
[c4c]      import { TelegramProcedures } from './procedures/integrations/telegram/procedures.gen.js'
[c4c]   2. Register them with your registry
[c4c]   3. Set the TELEGRAM_TOKEN environment variable
```

## Step 2: Generated Files Overview

### SDK (`generated/telegram/sdk.gen.ts`)
Contains 70+ type-safe API client functions:
- `postSendMessage()`
- `postGetUpdates()`
- `postSetWebhook()`
- ... and many more

### Procedures (`procedures/integrations/telegram/procedures.gen.ts`)
Contains c4c procedure definitions ready for workflow integration:
- `TelegramPostSendMessageProcedure`
- `TelegramPostGetUpdatesProcedure`
- `TelegramPostSetWebhookProcedure`
- ... and many more

## Step 3: Using in Your Application

### Example 1: Basic Usage

```typescript
import { createRegistry } from '@c4c/core';
import { TelegramProcedures } from './procedures/integrations/telegram/procedures.gen.js';

// Create registry and register Telegram procedures
const registry = createRegistry();
for (const procedure of TelegramProcedures) {
  registry.register(procedure);
}

// Execute a Telegram API call
const result = await registry.execute('telegram.post.send.message', {
  chat_id: '123456789',
  text: 'Hello from c4c!'
});
```

### Example 2: With OAuth Context

```typescript
import { createExecutor } from '@c4c/core';

const executor = createExecutor(registry);

// Execute with OAuth token from context
const result = await executor.execute(
  'telegram.post.send.message',
  {
    chat_id: '123456789',
    text: 'Hello from c4c!'
  },
  {
    metadata: {
      telegramToken: 'bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
    }
  }
);
```

### Example 3: In a Workflow

```typescript
import { createWorkflow } from '@c4c/workflow';

const telegramNotificationWorkflow = createWorkflow({
  name: 'telegram-notification',
  trigger: {
    type: 'webhook',
    path: '/notify'
  },
  steps: [
    {
      id: 'send-message',
      procedure: 'telegram.post.send.message',
      input: {
        chat_id: '{{ trigger.data.chat_id }}',
        text: '{{ trigger.data.message }}'
      }
    }
  ]
});
```

## Step 4: Environment Setup

Set the Telegram Bot Token:

```bash
export TELEGRAM_TOKEN=bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
```

Or provide it in the execution context as shown in Example 2.

## Available Telegram Procedures

Here's a sample of the 70+ generated procedures:

### Messaging
- `telegram.post.send.message` - Send text messages
- `telegram.post.send.photo` - Send photos
- `telegram.post.send.video` - Send videos
- `telegram.post.send.document` - Send documents
- `telegram.post.send.audio` - Send audio files
- `telegram.post.send.voice` - Send voice messages
- `telegram.post.send.location` - Send location
- `telegram.post.send.contact` - Send contact

### Updates
- `telegram.post.get.updates` - Get updates (polling)
- `telegram.post.set.webhook` - Set webhook URL
- `telegram.post.delete.webhook` - Delete webhook
- `telegram.post.get.webhook.info` - Get webhook info

### Chat Management
- `telegram.post.get.chat` - Get chat info
- `telegram.post.get.chat.administrators` - Get chat admins
- `telegram.post.leave.chat` - Leave chat
- `telegram.post.kick.chat.member` - Kick chat member
- `telegram.post.unban.chat.member` - Unban chat member

### Message Editing
- `telegram.post.edit.message.text` - Edit message text
- `telegram.post.edit.message.caption` - Edit message caption
- `telegram.post.delete.message` - Delete message

### And many more...

## Integrating Other APIs

The same pattern works for any OpenAPI-compliant API:

```bash
# GitHub API
c4c integrate https://api.apis.guru/v2/specs/github.com/1.1.4/openapi.json

# Stripe API  
c4c integrate https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json

# Your custom API
c4c integrate https://your-api.com/openapi.json --name myapi
```

## Advanced: Custom Integration Name

```bash
c4c integrate https://api.example.com/v2/openapi.json --name example-v2
```

This will generate:
- SDK in: `generated/example-v2/`
- Procedures in: `procedures/integrations/example-v2/procedures.gen.ts`
- Procedures exported as: `ExampleV2Procedures`

## Tips

1. **OAuth Tokens**: Always use environment variables or secure context for API tokens
2. **Rate Limiting**: Consider adding rate limiting policies to generated procedures
3. **Error Handling**: Wrap procedure calls in try-catch for production use
4. **Type Safety**: Generated procedures maintain full TypeScript type safety
5. **Regeneration**: Re-run the integrate command to update when the API changes

## Troubleshooting

### Issue: "Required files not found"
**Solution**: Make sure the OpenAPI spec is valid and accessible

### Issue: "No procedures generated"
**Solution**: Check that the OpenAPI spec has valid operations with proper schemas

### Issue: "OAuth not working"
**Solution**: Verify the environment variable name matches the integration name (e.g., `TELEGRAM_TOKEN`)

## What's Next?

The generated procedures are now ready to use in:
- Direct API calls via registry
- Workflow definitions
- Custom procedures that compose multiple API calls
- Background jobs and scheduled tasks

Enjoy your new API integration! 🚀
