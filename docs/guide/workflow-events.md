# Workflow Events

Handle internal and external events with a simple, declarative API using `workflow.on()`.

## Overview

The workflow system now supports event-driven workflows through the `workflow.on(eventName, step)` method. This allows you to:

- **Internal Events**: Respond to events within your application (e.g., `user.created`, `order.placed`)
- **External Events**: Handle webhooks from external services (e.g., Telegram, Slack, GitHub)
- **Unified API**: Same simple API for both internal and external events

## Why Use workflow.on()?

### Traditional Approach

```typescript
// Manual event handling - no tracing, monitoring, or error handling
eventBus.on('user.created', async (userData) => {
  try {
    await sendWelcomeEmail(userData.email);
    await trackUserSignup(userData.id);
    await notifyAdmins(userData);
  } catch (error) {
    console.error('Failed to process user.created', error);
  }
});
```

### With workflow.on()

```typescript
// Declarative, traceable, monitorable workflow
const userCreatedWorkflow = workflow('user-created-handler')
  .on('user.created',
    step({
      id: 'send-welcome-email',
      procedure: 'email.send',
      input: z.object({ email: z.string() }),
      output: z.object({ sent: z.boolean() }),
    }),
    { internal: true }
  )
  .step(step({ id: 'track-signup', procedure: 'analytics.track' }))
  .step(step({ id: 'notify-admins', procedure: 'notification.send' }))
  .commit();
```

**Benefits:**
- ✅ Automatic OpenTelemetry tracing
- ✅ Built-in error handling and retries
- ✅ Execution monitoring and debugging
- ✅ Visual workflow representation
- ✅ Type-safe with Zod schemas
- ✅ Easy to test and maintain

## Internal Events

Internal events are emitted from within your application and trigger workflows.

### Step 1: Define Workflow

```typescript
import { workflow, step } from '@c4c/workflow';
import { z } from 'zod';

const orderWorkflow = workflow('order-handler')
  .name('Order Processing Handler')
  .description('Processes new orders')
  .on(
    'order.placed',           // Event name
    step({
      id: 'validate-order',
      procedure: 'order.validate',
      input: z.object({
        orderId: z.string(),
        items: z.array(z.any()),
      }),
      output: z.object({
        valid: z.boolean(),
      }),
    }),
    { internal: true }        // Mark as internal event
  )
  .step(
    step({
      id: 'charge-payment',
      procedure: 'payment.charge',
      input: z.object({ orderId: z.string() }),
      output: z.object({ charged: z.boolean() }),
    })
  )
  .commit();
```

### Step 2: Register Workflow

```typescript
import { createRegistry } from '@c4c/core';
import { 
  createTriggerWorkflowManager,
  getWorkflowEventEmitter,
} from '@c4c/workflow';

const registry = createRegistry();
// ... register your procedures

const triggerManager = createTriggerWorkflowManager(registry);
const eventEmitter = getWorkflowEventEmitter();

// Register internal event handler
for (const node of orderWorkflow.nodes) {
  if (node.type === 'trigger' && node.config?.internal) {
    eventEmitter.on(node.config.eventName, async (payload) => {
      const { executeWorkflow } = await import('@c4c/workflow');
      await executeWorkflow(orderWorkflow, registry, {
        trigger: { event: node.config.eventName, payload },
        ...payload,
      });
    });
  }
}
```

### Step 3: Emit Events

```typescript
import { emitWorkflowEvent } from '@c4c/workflow';

// Emit event from your application code
await emitWorkflowEvent('order.placed', {
  orderId: 'order_123',
  userId: 'user_456',
  items: [
    { productId: 'prod_1', quantity: 2 },
  ],
});
```

## External Events (Webhooks)

External events come from external services via webhooks.

### Step 1: Define Workflow

```typescript
const telegramWorkflow = workflow('telegram-bot')
  .name('Telegram Bot Handler')
  .on(
    'telegram.message',       // Event name
    step({
      id: 'handle-message',
      procedure: 'telegram.handle.message',
      input: z.object({ update: z.any() }),
      output: z.object({ reply: z.string() }),
    }),
    {
      provider: 'telegram',   // External provider
      eventType: 'message',   // Filter by event type
      internal: false,        // External webhook
    }
  )
  .step(
    step({
      id: 'send-reply',
      procedure: 'telegram.post.send.message',
      input: z.object({ 
        chat_id: z.number(),
        text: z.string(),
      }),
      output: z.object({ ok: z.boolean() }),
    })
  )
  .commit();
```

### Step 2: Deploy with Webhook

```typescript
import { createHttpServer, WebhookRegistry } from '@c4c/adapters';

const webhookRegistry = new WebhookRegistry();
const triggerManager = createTriggerWorkflowManager(registry, webhookRegistry);

// Deploy workflow with webhook URL
await triggerManager.deploy(telegramWorkflow, {
  webhookUrl: 'https://your-domain.com/webhooks/telegram',
  subscriptionConfig: {
    // Provider-specific configuration
  },
});

// Start HTTP server
const server = createHttpServer(registry, 3000, {
  enableWebhooks: true,
  webhookRegistry,
});

// Telegram will now send events to:
// POST https://your-domain.com/webhooks/telegram
```

## Event Patterns

### Wildcard Events

Match multiple events with wildcards:

```typescript
// Matches: audit.login, audit.logout, audit.action, etc.
const auditWorkflow = workflow('audit-logger')
  .on(
    'audit.*',
    step({
      id: 'log-event',
      procedure: 'audit.log',
      input: z.object({ eventType: z.string() }),
      output: z.object({ logged: z.boolean() }),
    }),
    { internal: true }
  )
  .commit();
```

### Multiple Event Handlers

Create separate workflows for different events:

```typescript
// User lifecycle events
const userCreated = workflow('user-created').on('user.created', ...).commit();
const userUpdated = workflow('user-updated').on('user.updated', ...).commit();
const userDeleted = workflow('user-deleted').on('user.deleted', ...).commit();

// Register all
[userCreated, userUpdated, userDeleted].forEach(wf => {
  // Register with trigger manager or event emitter
});
```

## API Reference

### workflow.on()

```typescript
workflow(id)
  .on(eventName, step, options?)
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `eventName` | `string` | Event name to listen for (supports wildcards) |
| `step` | `WorkflowComponent` | Step to execute when event fires |
| `options` | `object` | Optional configuration |
| `options.provider` | `string` | Provider for external events |
| `options.eventType` | `string` | Event type filter |
| `options.internal` | `boolean` | Internal event (default: true if no provider) |

**Returns:** `this` (chainable)

### emitWorkflowEvent()

```typescript
await emitWorkflowEvent(eventName, payload)
```

Emit an internal event that triggers workflows.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `eventName` | `string` | Event name |
| `payload` | `any` | Event payload data |

**Returns:** `Promise<void>`

### onWorkflowEvent()

```typescript
const unsubscribe = onWorkflowEvent(eventName, handler)
```

Subscribe to internal workflow events (lower-level API).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `eventName` | `string` | Event name to listen for |
| `handler` | `function` | Handler function `(payload) => void \| Promise<void>` |

**Returns:** `() => void` (unsubscribe function)

### WorkflowEventEmitter

```typescript
import { getWorkflowEventEmitter } from '@c4c/workflow';

const emitter = getWorkflowEventEmitter();
```

**Methods:**

- `on(eventName, handler)` - Subscribe to event
- `once(eventName, handler)` - Subscribe once
- `emit(eventName, payload)` - Emit event
- `off(eventName)` - Remove all handlers for event
- `clear()` - Remove all handlers
- `listenerCount(eventName)` - Get handler count
- `eventNames()` - Get all registered events

## Best Practices

### Event Naming

Use namespaced, hierarchical event names:

```typescript
// ✅ Good
'user.created'
'order.placed'
'payment.succeeded'
'notification.sent'

// ❌ Avoid
'userCreated'
'new-order'
'payment_ok'
```

### Event Payloads

Keep payloads simple and JSON-serializable:

```typescript
// ✅ Good
await emitWorkflowEvent('user.created', {
  userId: 'user_123',
  email: 'john@example.com',
  timestamp: new Date().toISOString(),
});

// ❌ Avoid
await emitWorkflowEvent('user.created', {
  user: new UserModel(), // Complex objects
  callback: () => {},    // Functions
  buffer: Buffer.from(), // Buffers
});
```

### Error Handling

Let the workflow runtime handle errors:

```typescript
// ✅ Good - workflow runtime handles errors
const workflow = workflow('user-handler')
  .on('user.created', step({ ... }))
  .commit();

// ❌ Avoid - manual try/catch
eventBus.on('user.created', async (data) => {
  try {
    await processUser(data);
  } catch (error) {
    // Manual error handling
  }
});
```

### Testing

Emit test events in your tests:

```typescript
import { emitWorkflowEvent } from '@c4c/workflow';

test('user created workflow', async () => {
  // Setup
  const workflow = createUserWorkflow();
  // ... register workflow

  // Emit test event
  await emitWorkflowEvent('user.created', {
    userId: 'test_123',
    email: 'test@example.com',
  });

  // Assert
  // ... check workflow execution
});
```

### Monitoring

Use the execution store to monitor workflows:

```typescript
import { getExecutionStore } from '@c4c/workflow';

const store = getExecutionStore();

// Get recent executions
const executions = store.listExecutions();

// Get specific execution
const execution = store.getExecution(executionId);

console.log('Status:', execution.status);
console.log('Duration:', execution.duration);
console.log('Nodes:', execution.nodes);
```

## Examples

### Complete Example

See the complete working examples:

- [`examples/basic/workflows/events-example.ts`](/examples/basic/workflows/events-example.ts) - Workflow definitions
- [`examples/basic/events-demo.ts`](/examples/basic/events-demo.ts) - Running demo
- [`docs/examples/workflow-events.md`](/docs/examples/workflow-events.md) - Detailed guide

### Real-World Use Cases

**E-commerce Order Processing:**
```typescript
workflow('order-processing')
  .on('order.placed', step({ procedure: 'payment.charge' }))
  .step(step({ procedure: 'inventory.reserve' }))
  .step(step({ procedure: 'shipping.create' }))
  .step(step({ procedure: 'notification.send' }))
  .commit();
```

**User Onboarding:**
```typescript
workflow('user-onboarding')
  .on('user.registered', step({ procedure: 'email.verify' }))
  .step(step({ procedure: 'profile.create' }))
  .step(step({ procedure: 'welcome.send' }))
  .step(step({ procedure: 'analytics.track' }))
  .commit();
```

**Chat Bot:**
```typescript
workflow('chatbot')
  .on('telegram.message', step({ procedure: 'ai.process' }), {
    provider: 'telegram',
    eventType: 'message',
  })
  .step(step({ procedure: 'telegram.reply' }))
  .commit();
```

## Architecture

### Internal Events Flow

```
Application Code
      ↓
emitWorkflowEvent('user.created', data)
      ↓
WorkflowEventEmitter
      ↓
Registered Event Handlers
      ↓
executeWorkflow(workflow, registry, data)
      ↓
Workflow Execution (with tracing)
```

### External Events Flow

```
External Service (Telegram)
      ↓
POST /webhooks/telegram
      ↓
WebhookRegistry
      ↓
TriggerWorkflowManager
      ↓
executeWorkflow(workflow, registry, event)
      ↓
Workflow Execution (with tracing)
```

## Troubleshooting

### Event Not Triggering Workflow

1. Check if workflow is registered:
   ```typescript
   const emitter = getWorkflowEventEmitter();
   console.log('Listeners:', emitter.listenerCount('user.created'));
   ```

2. Check event name matches:
   ```typescript
   // Must match exactly
   .on('user.created', ...)
   emitWorkflowEvent('user.created', ...)
   ```

3. Check internal flag:
   ```typescript
   .on('event.name', step, { internal: true })
   ```

### Workflow Not Executing

1. Check if procedures are registered:
   ```typescript
   console.log('Has procedure:', registry.has('email.send'));
   ```

2. Check workflow validation:
   ```typescript
   import { validateWorkflow } from '@c4c/workflow';
   const errors = validateWorkflow(workflow, registry);
   console.log('Errors:', errors);
   ```

3. Enable debug logging:
   ```typescript
   // Workflow execution logs to console
   ```

## Next Steps

- [View Workflow Builder API](/guide/workflows)
- [Learn about Triggers](/guide/triggers)
- [Explore Integration Examples](/examples/integrations)
- [OpenTelemetry Tracing](/guide/opentelemetry)
