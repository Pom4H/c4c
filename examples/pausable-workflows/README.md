# Pausable Workflows Example

This example demonstrates the **pausable workflow** functionality using the `when()` helper.

## Features

- **Workflow Pause/Resume**: Workflows can pause execution and wait for external events
- **Human-in-the-Loop**: Pause for manual approval or decision-making
- **Event-Driven Continuation**: Resume workflow when specific triggers fire
- **Filter Functions**: Type-safe filtering to match specific events
- **Timeout Handling**: Configure timeouts for paused workflows
- **Switch-Case Routing**: Route to different pause points based on conditions

## What is `when()`?

The `when()` helper creates **await nodes** in workflows - pause points that wait for external events before continuing:

```typescript
import { workflow, step, when } from '@c4c/workflow';

const awaitApproval = when({
  id: 'await-approval',
  on: 'approval.trigger',
  filter: (event, context) => {
    // Only resume for this specific order
    return event.orderId === context.variables.orderId;
  },
  timeout: {
    duration: 24 * 60 * 60 * 1000, // 24 hours
    onTimeout: 'timeout-cancel',
  },
  output: z.object({ approved: z.boolean() }),
});
```

## Use Cases

### 1. Order Approval Workflow
```typescript
const processOrder = workflow('process-order')
  .step(calculateRisk)
  .step(condition({
    switch: ({ inputData }) => inputData.riskLevel,
    cases: {
      'low': processImmediately,
      'high': awaitManagerApproval,  // <- pause here
    }
  }))
  .step(completeOrder)
  .commit();
```

### 2. Payment Confirmation
```typescript
const awaitPayment = when({
  id: 'await-payment',
  on: 'payment.completed',
  timeout: { duration: 72 * 60 * 60 * 1000 }, // 72 hours
  output: PaymentSchema,
});
```

### 3. Multi-Step Approval Chain
```typescript
workflow('multi-approval')
  .step(submitRequest)
  .step(awaitManagerApproval)   // pause 1
  .step(awaitFinanceApproval)   // pause 2
  .step(awaitDirectorApproval)  // pause 3
  .step(execute)
  .commit();
```

## Running Tests

```bash
cd examples/pausable-workflows
pnpm install
pnpm test
```

## Test Coverage

The test suite verifies:

- ✅ **Basic Pause/Resume**: Workflow pauses at `when()` and resumes correctly
- ✅ **Context Preservation**: Variables persist across pause/resume
- ✅ **Multiple Pause Points**: Sequential pauses work correctly
- ✅ **Filter Functions**: Event matching with custom logic
- ✅ **Switch-Case Integration**: Routing to different await nodes
- ✅ **Timeout Configuration**: Timeout metadata is preserved
- ✅ **Normal Execution**: Workflows without pause points work normally

## Architecture

### Pause Flow

1. Workflow executes until it reaches a `when()` node
2. Execution **pauses**, creating a `WorkflowPauseState`:
   ```typescript
   {
     pausedAt: 'await-approval',
     waitingFor: {
       procedures: ['approval.trigger'],
       filter: (event, context) => boolean
     },
     variables: { orderId: '123', ... },
     timeoutAt: '2025-10-27T10:00:00Z'
   }
   ```
3. State is serialized and stored (in-memory or database)
4. Workflow waits for matching event

### Resume Flow

1. External event arrives (webhook, API call, internal trigger)
2. System checks if event matches any paused workflow:
   - Procedure name matches `waitingFor.procedures`
   - Filter function returns `true`
3. Workflow resumes from `pausedAt` node
4. Execution continues to completion or next pause point

## API

### `when()` Options

```typescript
interface WhenOptions {
  id: string;                  // Unique node ID
  on: string | string[];       // Trigger procedure(s) to wait for
  mode?: 'before' | 'after' | 'instead';  // When to intercept (default: after)
  filter?: (event, context) => boolean;   // Optional: filter events
  timeout?: {
    duration: number;          // Timeout in milliseconds
    onTimeout?: string;        // Node to execute on timeout
  };
  output: ZodSchema;           // Expected data schema from trigger
}
```

### `executeWorkflow()`

```typescript
const result = await executeWorkflow(workflow, registry, initialInput);

if (result.status === 'paused') {
  // Store result.resumeState
  console.log('Paused at:', result.resumeState.pausedAt);
  console.log('Waiting for:', result.resumeState.waitingFor.procedures);
}
```

### `resumeWorkflow()`

```typescript
const result = await resumeWorkflow(
  workflow,
  registry,
  pauseState,
  triggerData  // Data from the event that triggered resume
);
```

## Best Practices

1. **Always set timeouts** to prevent workflows from waiting indefinitely
2. **Use filter functions** to ensure correct workflow resumes
3. **Store pause state reliably** - use database in production
4. **Monitor paused workflows** - implement dashboard/alerting
5. **Handle timeout gracefully** - provide fallback logic

## Related Examples

- `examples/triggers` - Basic trigger setup
- `examples/cross-integration` - Cross-service workflows
- `examples/cross-integration/order-processing` - Complex business case with human-in-the-loop

## See Also

- [Workflows Guide](../../docs/guide/workflows.md)
- [Triggers Guide](../../docs/guide/triggers.md)
- [@c4c/workflow Package](../../docs/packages/workflow.md)
