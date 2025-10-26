# Unified Event System

Handle internal and external events through the same mechanism - **trigger procedures**. Your workflows stay identical when moving from monolith to microservices!

## The Problem

Traditional event systems force you to rewrite workflows when refactoring:

```typescript
// ❌ In monolith:
eventBus.on('user.created', async (data) => {
  await sendWelcomeEmail(data);
  await trackSignup(data);
});

// ❌ In microservices: completely different code!
app.post('/webhooks/users', async (req, res) => {
  const data = req.body;
  await sendWelcomeEmail(data);
  await trackSignup(data);
});
```

## The Solution

**Trigger procedures** provide a unified mechanism:

```typescript
// ✅ Define once - works for both!
const userCreatedTrigger = createTriggerProcedure(
  'user.trigger.created',
  z.object({ userId: z.string(), email: z.string() })
);

const workflow = workflow('user-onboarding')
  .on('user.trigger.created', step({ ... }))
  .commit();

// Monolith: emit internally
await emitTriggerEvent('user.trigger.created', data, registry);

// Microservices: webhook calls the same trigger
// POST /webhooks/users → user.trigger.created → workflow
```

**Zero workflow changes!** 🎉

## How It Works

### 1. Define Trigger Procedures

Trigger procedures describe events with schemas:

```typescript
import { createTriggerProcedure } from '@c4c/workflow';
import { z } from 'zod';

// Define event schema and metadata
export const orderPlacedTrigger = createTriggerProcedure(
  'order.trigger.placed',
  z.object({
    orderId: z.string(),
    userId: z.string(),
    amount: z.number(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number(),
    })),
  }),
  {
    description: 'Triggered when an order is placed',
    provider: 'orders',
    eventTypes: ['placed'],
    exposure: 'internal', // or 'external' for webhooks
  }
);

// Register in registry
registry.register(orderPlacedTrigger);
```

### 2. Create Workflows Using Triggers

Workflows reference trigger procedures via `.trigger()`:

```typescript
import { workflow, step } from '@c4c/workflow';

const orderProcessingWorkflow = workflow('order-processing')
  .name('Order Processing')
  .trigger({
    provider: 'orders',
    triggerProcedure: 'order.trigger.placed',
  })
  .step(step({
    id: 'charge-payment',
    procedure: 'payment.charge',
    input: z.object({
      orderId: z.string(),
      amount: z.number(),
    }),
    output: z.object({
      success: z.boolean(),
    }),
  }))
  .step(step({
    id: 'send-confirmation',
    procedure: 'email.send',
    input: z.object({ ... }),
    output: z.object({ ... }),
  }))
  .commit();

// Or use declarative definition:
const orderWorkflow: WorkflowDefinition = {
  id: 'order-processing',
  name: 'Order Processing',
  trigger: {
    provider: 'orders',
    triggerProcedure: 'order.trigger.placed',
  },
  nodes: [
    {
      id: 'charge-payment',
      type: 'procedure',
      procedureName: 'payment.charge',
      next: 'send-confirmation',
    },
    {
      id: 'send-confirmation',
      type: 'procedure',
      procedureName: 'email.send',
    },
  ],
  startNode: 'charge-payment',
  version: '1.0.0',
};
```

### 3. Register Workflows

Register workflows with the trigger manager:

```typescript
import { registerTriggerHandler } from '@c4c/workflow';

registerTriggerHandler(
  'order.trigger.placed',
  orderProcessingWorkflow,
  registry
);
```

### 4. Emit Events

#### In Monolith (Internal)

```typescript
import { emitTriggerEvent } from '@c4c/workflow';

// In your application code
async function createOrder(orderData) {
  const order = await db.orders.create(orderData);
  
  // Emit trigger event - workflows will execute automatically
  await emitTriggerEvent(
    'order.trigger.placed',
    {
      orderId: order.id,
      userId: order.userId,
      amount: order.amount,
      items: order.items,
    },
    registry
  );
  
  return order;
}
```

#### In Microservices (External)

```typescript
import { createHttpServer, WebhookRegistry } from '@c4c/adapters';

const webhookRegistry = new WebhookRegistry();

// Register webhook handler that calls trigger procedure
webhookRegistry.registerHandler('orders', async (event) => {
  // Webhook automatically calls order.trigger.placed procedure
  // which executes all registered workflows
});

const server = createHttpServer(registry, 3000, {
  enableWebhooks: true,
  webhookRegistry,
});

// External service calls:
// POST /webhooks/orders → order.trigger.placed → workflows execute
```

**The workflow code doesn't change at all!**

## Migration Path

### Step 1: Monolith with Trigger Procedures

```typescript
// triggers.ts
export const userCreatedTrigger = createTriggerProcedure(
  'user.trigger.created',
  UserSchema,
  { exposure: 'internal' }
);

// workflows.ts
const workflow = workflow('user-onboarding')
  .trigger({
    provider: 'users',
    triggerProcedure: 'user.trigger.created',
  })
  .step(step({ ... }))
  .commit();

// app.ts
await createUser(data);
await emitTriggerEvent('user.trigger.created', user, registry);
```

### Step 2: Extract to Microservice

```typescript
// triggers.ts - ONLY CHANGE: exposure
export const userCreatedTrigger = createTriggerProcedure(
  'user.trigger.created',
  UserSchema,
  { exposure: 'external' } // ← Only this changes!
);

// workflows.ts - NO CHANGES!
const workflow = workflow('user-onboarding')
  .trigger({
    provider: 'users',
    triggerProcedure: 'user.trigger.created',
  })
  .step(step({ ... }))
  .commit();

// Service A (user service)
await createUser(data);
// Now call webhook instead of emitTriggerEvent:
await fetch('https://service-b/webhooks/users', {
  method: 'POST',
  body: JSON.stringify(user),
});

// Service B (workflow service) - NO CHANGES to workflow!
// Just receives webhook and executes workflow
```

## Benefits

### 1. **Portable Workflows**

Workflows are defined once and work everywhere:

```typescript
// Same workflow definition works in:
✅ Monolith
✅ Microservices
✅ Serverless functions
✅ Edge workers
```

### 2. **Type Safety**

Events are validated with Zod schemas:

```typescript
const trigger = createTriggerProcedure(
  'user.created',
  z.object({
    userId: z.string(),
    email: z.string().email(),
  })
);

// ✅ Valid
await emitTriggerEvent('user.created', {
  userId: '123',
  email: 'john@example.com',
}, registry);

// ❌ Invalid - Zod validation fails
await emitTriggerEvent('user.created', {
  userId: 123, // should be string
}, registry);
```

### 3. **Automatic Tracing**

All trigger invocations are traced with OpenTelemetry:

```typescript
// Trace hierarchy:
trigger.procedure
  └── workflow.execute
      ├── step.charge-payment
      ├── step.reserve-inventory
      └── step.send-confirmation
```

### 4. **Multiple Workflows per Trigger**

Multiple workflows can listen to the same trigger:

```typescript
// Workflow 1: Send email
const emailWorkflow = workflow('send-email')
  .on('user.trigger.created', step({ ... }))
  .commit();

// Workflow 2: Track analytics
const analyticsWorkflow = workflow('track-signup')
  .on('user.trigger.created', step({ ... }))
  .commit();

// Both execute when trigger fires!
await emitTriggerEvent('user.trigger.created', user, registry);
```

### 5. **Easy Testing**

Test workflows by emitting trigger events:

```typescript
test('order processing workflow', async () => {
  // Setup
  const registry = createRegistry();
  registry.register(orderPlacedTrigger);
  registry.register(orderProcessingWorkflow);
  
  // Emit trigger
  await emitTriggerEvent('order.trigger.placed', {
    orderId: 'test-123',
    amount: 99.99,
  }, registry);
  
  // Assert workflow executed
  expect(mockPaymentService.charge).toHaveBeenCalled();
});
```

## API Reference

### createTriggerProcedure()

Create a trigger procedure:

```typescript
createTriggerProcedure(
  name: string,
  schema: ZodSchema,
  options?: {
    description?: string,
    provider?: string,
    eventTypes?: string[],
    exposure?: 'internal' | 'external',
  }
): Procedure
```

### workflow.trigger()

Set trigger configuration for workflow:

```typescript
workflow(id)
  .trigger({
    provider: string,
    triggerProcedure: string,
    eventType?: string,
  })
  .step(...)
  .commit()
```

### emitTriggerEvent()

Emit a trigger event (monolith):

```typescript
await emitTriggerEvent(
  triggerProcedureName: string,
  eventData: unknown,
  registry: Registry
): Promise<void>
```

### registerTriggerHandler()

Register workflow for trigger (advanced):

```typescript
const unsubscribe = registerTriggerHandler(
  triggerProcedureName: string,
  workflow: WorkflowDefinition,
  registry: Registry
): () => void
```

## Best Practices

### 1. Naming Convention

Use consistent naming for trigger procedures:

```typescript
// ✅ Good
'user.trigger.created'
'order.trigger.placed'
'payment.trigger.succeeded'

// ❌ Avoid
'userCreated'
'new-order'
'paymentOk'
```

### 2. Schema Definition

Define comprehensive schemas:

```typescript
// ✅ Good - detailed schema
const trigger = createTriggerProcedure(
  'order.trigger.placed',
  z.object({
    orderId: z.string().uuid(),
    userId: z.string().uuid(),
    amount: z.number().positive(),
    currency: z.string().length(3),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
    })).min(1),
    createdAt: z.date(),
  })
);

// ❌ Avoid - loose schema
const trigger = createTriggerProcedure(
  'order.placed',
  z.any()
);
```

### 3. Exposure Setting

Set exposure based on architecture:

```typescript
// Monolith
{ exposure: 'internal' }

// Microservices (trigger comes from webhook)
{ exposure: 'external' }

// Hybrid (can be both)
{ exposure: 'external' } // More flexible
```

### 4. Error Handling

Let the workflow runtime handle errors:

```typescript
// ✅ Good - workflow handles errors
const workflow = workflow('order-processing')
  .on('order.trigger.placed', step({ ... }))
  .step(step({ ... }))
  .commit();

// ❌ Avoid - manual error handling
await emitTriggerEvent('order.placed', data, registry)
  .catch(err => {
    // Don't do this - workflow runtime handles errors
  });
```

## Examples

### Complete Example

See [`examples/basic/unified-events-demo.ts`](/examples/basic/unified-events-demo.ts) for a complete working example.

### Real-World Use Cases

**E-commerce Platform:**

```typescript
// Triggers
const triggers = [
  createTriggerProcedure('order.trigger.placed', OrderSchema),
  createTriggerProcedure('payment.trigger.succeeded', PaymentSchema),
  createTriggerProcedure('shipment.trigger.dispatched', ShipmentSchema),
];

// Workflows
const orderWorkflow = workflow('order-processing')
  .trigger({ provider: 'orders', triggerProcedure: 'order.trigger.placed' })
  .step(step({ ... }))
  .commit();

const fulfillmentWorkflow = workflow('fulfillment')
  .trigger({ provider: 'payments', triggerProcedure: 'payment.trigger.succeeded' })
  .step(step({ ... }))
  .commit();

const trackingWorkflow = workflow('tracking')
  .trigger({ provider: 'shipments', triggerProcedure: 'shipment.trigger.dispatched' })
  .step(step({ ... }))
  .commit();

// Monolith: all internal
await emitTriggerEvent('order.trigger.placed', order, registry);

// Microservices: webhooks
// POST /webhooks/orders → order.trigger.placed
// POST /webhooks/payments → payment.trigger.succeeded
// POST /webhooks/shipments → shipment.trigger.dispatched
```

## Troubleshooting

### Trigger Not Found

```typescript
// Error: Trigger procedure not found
await emitTriggerEvent('user.created', data, registry);

// Solution: Register trigger procedure
const trigger = createTriggerProcedure('user.created', schema);
registry.register(trigger);
```

### Workflow Not Executing

```typescript
// Check if workflow is registered for trigger
import { getTriggerHandlerCount } from '@c4c/workflow';

const count = getTriggerHandlerCount('user.trigger.created');
console.log('Registered workflows:', count);
```

### Type Validation Errors

```typescript
// Enable Zod error details
const trigger = createTriggerProcedure(
  'user.created',
  z.object({ email: z.string().email() })
);

// Invalid email will throw detailed Zod error
await emitTriggerEvent('user.created', {
  email: 'invalid',
}, registry);
```

## Next Steps

- [View Complete Example](/examples/basic/unified-events-demo.ts)
- [Learn about Workflows](/guide/workflows)
- [Explore Triggers](/guide/triggers)
- [Cross-Service Integration](/examples/cross-integration)
