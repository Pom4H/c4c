# Workflow Events Example

Event-driven workflows using `workflow.on()` method.

## Overview

The `workflow.on(eventName, step)` method allows you to create workflows that are triggered by events, both **internal** (application events) and **external** (webhooks from external services).

## Features

- 🎯 Simple event subscription API
- 🔄 Support for internal application events
- 🌐 Support for external webhook events
- 🎭 Wildcard event patterns
- 🔗 Chain multiple steps after event trigger
- 🧹 Automatic cleanup on workflow stop

## Usage

### Internal Events

Internal events are emitted from within your application code and trigger workflows automatically.

```typescript
import { workflow, step, emitWorkflowEvent } from '@c4c/workflow';
import { z } from 'zod';

// Define workflow that listens to internal event
const userCreatedWorkflow = workflow('user-created-handler')
  .name('User Created Handler')
  .on(
    'user.created',
    step({
      id: 'send-welcome-email',
      procedure: 'email.send',
      input: z.object({
        userId: z.string(),
        email: z.string(),
        name: z.string(),
      }),
      output: z.object({
        emailSent: z.boolean(),
      }),
    }),
    { internal: true } // Mark as internal event
  )
  .commit();

// Emit event from your code
await emitWorkflowEvent('user.created', {
  userId: 'user_123',
  email: 'john@example.com',
  name: 'John Doe',
});
```

### External Events (Webhooks)

External events come from external services like Telegram, Slack, GitHub, etc.

```typescript
const telegramWorkflow = workflow('telegram-handler')
  .name('Telegram Message Handler')
  .on(
    'telegram.message',
    step({
      id: 'handle-message',
      procedure: 'telegram.handle.message',
      input: z.object({
        update: z.any(),
      }),
      output: z.object({
        reply: z.string(),
      }),
    }),
    {
      provider: 'telegram',      // External provider
      eventType: 'message',      // Filter by event type
      internal: false,           // External event
    }
  )
  .commit();
```

### Chaining Steps

You can chain multiple steps after the event trigger:

```typescript
const orderWorkflow = workflow('order-handler')
  .on(
    'order.placed',
    step({
      id: 'process-payment',
      procedure: 'payment.process',
      input: z.object({ orderId: z.string() }),
      output: z.object({ success: z.boolean() }),
    }),
    { internal: true }
  )
  .step(
    step({
      id: 'update-inventory',
      procedure: 'inventory.update',
      input: z.object({ orderId: z.string() }),
      output: z.object({ updated: z.boolean() }),
    })
  )
  .step(
    step({
      id: 'send-confirmation',
      procedure: 'email.send',
      input: z.object({ orderId: z.string() }),
      output: z.object({ sent: z.boolean() }),
    })
  )
  .commit();
```

### Wildcard Events

Use wildcards to listen to multiple related events:

```typescript
const auditWorkflow = workflow('audit-logger')
  .on(
    'audit.*',  // Matches audit.login, audit.logout, audit.action, etc.
    step({
      id: 'log-event',
      procedure: 'audit.log',
      input: z.object({ eventType: z.string(), data: z.any() }),
      output: z.object({ logged: z.boolean() }),
    }),
    { internal: true }
  )
  .commit();
```

## Deployment

### Internal Events

For internal events, register the workflow with the trigger manager:

```typescript
import { createTriggerWorkflowManager } from '@c4c/workflow';

const triggerManager = createTriggerWorkflowManager(registry);

// The manager will automatically register internal event handlers
// when it encounters trigger nodes in the workflow
```

### External Events

For external events, deploy with webhook configuration:

```typescript
await triggerManager.deploy(telegramWorkflow, {
  webhookUrl: 'https://your-domain.com/webhooks/telegram',
  subscriptionConfig: {
    // Provider-specific configuration
  },
});
```

## API Reference

### `workflow.on(eventName, step, options?)`

Register an event handler for a workflow.

**Parameters:**

- `eventName` (string): Event name to listen for (supports wildcards like `"user.*"`)
- `step` (WorkflowComponent): Step to execute when event fires
- `options` (optional):
  - `provider` (string): Provider for external events (e.g., "telegram", "slack")
  - `eventType` (string): Event type filter for external events
  - `internal` (boolean): Whether this is an internal event (default: `true` if no provider)

**Returns:** `this` (for chaining)

### `emitWorkflowEvent(eventName, payload)`

Emit an internal event that can trigger workflows.

**Parameters:**

- `eventName` (string): Event name
- `payload` (any): Event payload data

**Returns:** `Promise<void>`

### `onWorkflowEvent(eventName, handler)`

Subscribe to internal workflow events (lower-level API).

**Parameters:**

- `eventName` (string): Event name to listen for
- `handler` (function): Handler function `(payload) => void | Promise<void>`

**Returns:** `() => void` (unsubscribe function)

## Examples

See the complete examples:

- [`examples/basic/workflows/events-example.ts`](/examples/basic/workflows/events-example.ts) - Workflow definitions
- [`examples/basic/events-demo.ts`](/examples/basic/events-demo.ts) - Running demo

## Benefits

### vs Manual Event Handlers

**Before:**
```typescript
// Manual event handling
eventBus.on('user.created', async (data) => {
  await emailService.sendWelcome(data.email);
  await analyticsService.trackUser(data.userId);
  await notificationService.notify(data.userId);
});
```

**After:**
```typescript
// Declarative workflow with automatic tracing, error handling, and monitoring
const userCreatedWorkflow = workflow('user-created')
  .on('user.created', step({ ... }))
  .step(step({ ... }))
  .step(step({ ... }))
  .commit();
```

### Benefits:

- ✅ Automatic OpenTelemetry tracing
- ✅ Built-in error handling
- ✅ Execution monitoring and debugging
- ✅ Visual workflow representation
- ✅ Easy to test and maintain
- ✅ Declarative and composable

## Best Practices

1. **Event Naming**: Use namespaced event names (e.g., `user.created`, `order.placed`)
2. **Event Payloads**: Keep event payloads simple and JSON-serializable
3. **Error Handling**: Let the workflow runtime handle errors (with retries if needed)
4. **Testing**: Emit test events with `emitWorkflowEvent()` in your tests
5. **Monitoring**: Use the execution store to monitor workflow executions
6. **Cleanup**: Stop workflows with `triggerManager.stop()` or `stopAll()` on shutdown

## Next Steps

- [View Triggers Documentation](/guide/triggers)
- [Learn about Workflow Runtime](/guide/workflows)
- [Explore Integration Examples](/examples/integrations)
