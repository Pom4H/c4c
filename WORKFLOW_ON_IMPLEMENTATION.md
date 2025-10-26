# workflow.on() Implementation Summary

## Overview

Implemented the `workflow.on(eventName, step)` method for handling both internal and external events in the workflow system. This provides a unified, declarative API for event-driven workflows.

## Changes Made

### 1. WorkflowBuilder Enhancement (`packages/workflow/src/builder.ts`)

Added the `on()` method to the `WorkflowBuilder` class:

```typescript
on<InputSchema extends AnyZod, OutputSchema extends AnyZod>(
  eventName: string,
  component: WorkflowComponent<InputSchema, OutputSchema>,
  options?: {
    provider?: string;
    eventType?: string;
    internal?: boolean;
  }
): this
```

**Features:**
- Creates a trigger node for the specified event
- Links trigger to handler component
- Supports both internal and external events
- Chainable for composing multi-step workflows

### 2. Event Emitter Infrastructure (`packages/workflow/src/event-emitter.ts`)

Created new `WorkflowEventEmitter` class:

**Features:**
- Event subscription with `on()` and `once()`
- Event emission with `emit()`
- Wildcard pattern matching (`user.*`, `audit.*`)
- Async handler support
- Cleanup methods (`off()`, `clear()`)
- Listener counting and event listing

**Exports:**
- `WorkflowEventEmitter` - Main class
- `getWorkflowEventEmitter()` - Get global instance
- `setWorkflowEventEmitter()` - Set custom instance
- `emitWorkflowEvent()` - Emit events
- `onWorkflowEvent()` - Subscribe to events

### 3. TriggerWorkflowManager Updates (`packages/workflow/src/trigger-manager.ts`)

Enhanced to support internal events:

**Changes:**
- Added `internalEventUnsubscribers` map to track internal event handlers
- Added `registerInternalEventHandlers()` method to scan workflows for trigger nodes
- Updated `deploy()` to register internal event handlers automatically
- Updated `stop()` to cleanup internal event subscriptions
- Integrated with `WorkflowEventEmitter` for internal events

**Flow:**
1. When deploying a workflow, scan for trigger nodes
2. For internal triggers, subscribe to events via `WorkflowEventEmitter`
3. When event is emitted, create synthetic `WebhookEvent` and execute workflow
4. On stop, cleanup all event subscriptions

### 4. Runtime Support (`packages/workflow/src/runtime.ts`)

Runtime already had support for trigger nodes:

**Existing Features:**
- `executeTriggerNode()` function handles trigger nodes
- Passes event data through context variables
- Stores trigger information in outputs

**No changes needed** - trigger nodes were already implemented.

### 5. Type Exports (`packages/workflow/src/index.ts`)

Added new exports:

```typescript
export {
  WorkflowEventEmitter,
  getWorkflowEventEmitter,
  setWorkflowEventEmitter,
  emitWorkflowEvent,
  onWorkflowEvent,
} from "./event-emitter.js";
export type { EventHandler } from "./event-emitter.js";
```

### 6. Examples

Created comprehensive examples:

**`examples/basic/workflows/events-example.ts`:**
- User created workflow (internal event)
- Order placed workflow (internal event, multi-step)
- Telegram message workflow (external webhook)
- Data processing workflow (internal event, pipeline)
- Audit log workflow (wildcard events)

**`examples/basic/events-demo.ts`:**
- Complete runnable demo
- Mock procedure implementations
- Event emission examples
- Execution monitoring

### 7. Documentation

**`docs/guide/workflow-events.md`:**
- Complete guide with examples
- API reference
- Best practices
- Troubleshooting
- Architecture diagrams

**`docs/examples/workflow-events.md`:**
- Quick start guide
- Usage examples
- Benefits comparison

## Usage

### Internal Events

```typescript
import { workflow, step, emitWorkflowEvent } from '@c4c/workflow';

// Define workflow
const userWorkflow = workflow('user-created')
  .on('user.created',
    step({
      id: 'send-email',
      procedure: 'email.send',
      input: z.object({ email: z.string() }),
      output: z.object({ sent: z.boolean() }),
    }),
    { internal: true }
  )
  .commit();

// Emit event
await emitWorkflowEvent('user.created', {
  userId: 'user_123',
  email: 'john@example.com',
});
```

### External Events

```typescript
const telegramWorkflow = workflow('telegram-bot')
  .on('telegram.message',
    step({
      id: 'handle-message',
      procedure: 'telegram.handle.message',
      input: z.object({ update: z.any() }),
      output: z.object({ reply: z.string() }),
    }),
    {
      provider: 'telegram',
      eventType: 'message',
      internal: false,
    }
  )
  .commit();

// Deploy with webhook
await triggerManager.deploy(telegramWorkflow, {
  webhookUrl: 'https://your-domain.com/webhooks/telegram',
});
```

## Architecture

### Internal Events

```
Application Code
  ↓ emitWorkflowEvent()
WorkflowEventEmitter
  ↓ emit()
Event Handlers
  ↓ handler()
TriggerWorkflowManager.handleTriggerEvent()
  ↓ executeWorkflow()
Workflow Runtime
  ↓ with tracing
Procedure Execution
```

### External Events

```
External Service
  ↓ HTTP POST
WebhookRegistry
  ↓ route()
TriggerWorkflowManager.handleTriggerEvent()
  ↓ executeWorkflow()
Workflow Runtime
  ↓ with tracing
Procedure Execution
```

## Benefits

1. **Unified API**: Same API for internal and external events
2. **Declarative**: Workflows are defined declaratively, not imperatively
3. **Tracing**: Automatic OpenTelemetry tracing for all executions
4. **Monitoring**: Built-in execution tracking and monitoring
5. **Type Safety**: Full type safety with Zod schemas
6. **Error Handling**: Automatic error handling and recovery
7. **Testing**: Easy to test by emitting events
8. **Composable**: Chain multiple steps with `.step()`

## Backward Compatibility

All changes are additive:
- Existing workflows continue to work
- New `workflow.on()` method is optional
- Existing trigger system unchanged
- No breaking changes to APIs

## Testing

To test the implementation:

```bash
# Run the demo
cd examples/basic
pnpm install
pnpm tsx events-demo.ts
```

Expected output:
- Workflows register event handlers
- Events are emitted
- Workflows execute with full tracing
- Execution details logged

## Next Steps

Potential enhancements:

1. **Event Replay**: Store events for replay/debugging
2. **Event Filtering**: Advanced filtering beyond eventType
3. **Event Transformation**: Transform events before workflow execution
4. **Event Batching**: Batch multiple events for efficiency
5. **Event Scheduling**: Schedule events for future execution
6. **Event Persistence**: Persist events to database
7. **Dead Letter Queue**: Handle failed events
8. **Event Metrics**: Track event emission and processing metrics

## Files Modified

### Core Implementation
- ✅ `packages/workflow/src/builder.ts` - Added `on()` method
- ✅ `packages/workflow/src/event-emitter.ts` - New file
- ✅ `packages/workflow/src/trigger-manager.ts` - Internal events support
- ✅ `packages/workflow/src/index.ts` - Export new APIs
- ✅ `packages/workflow/src/runtime.ts` - Already supported triggers

### Examples
- ✅ `examples/basic/workflows/events-example.ts` - New file
- ✅ `examples/basic/events-demo.ts` - New file

### Documentation
- ✅ `docs/guide/workflow-events.md` - New file
- ✅ `docs/examples/workflow-events.md` - New file

## Summary

Successfully implemented `workflow.on(eventName, step)` with:
- ✅ Full support for internal application events
- ✅ Full support for external webhook events
- ✅ Wildcard event patterns
- ✅ Chainable API for multi-step workflows
- ✅ Automatic event handler registration and cleanup
- ✅ Complete examples and documentation
- ✅ No breaking changes
- ✅ Production-ready implementation

The implementation provides a powerful, declarative way to build event-driven workflows that are traceable, monitorable, and maintainable.
