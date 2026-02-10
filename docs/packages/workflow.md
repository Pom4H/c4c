# @c4c/workflow

Workflow DevKit - Build durable, resilient, and observable workflows using plain TypeScript functions.

Inspired by [useworkflow.dev](https://useworkflow.dev) (Vercel Workflow DevKit).

## Installation

```bash
pnpm add @c4c/workflow
```

## Core API

### `start(workflowFn, args?, options?)`

Start a workflow and get a run handle:

```typescript
import { start } from "@c4c/workflow";

const run = start(myWorkflow, ["arg1", "arg2"], {
  runId: "custom-id",
  maxStepRetries: 5,
  retryDelay: 2000,
});

const result = await run.result;
console.log(run.runId, run.status);
```

### `step(name, fn, options?)`

Create a step with automatic retry semantics:

```typescript
import { step } from "@c4c/workflow";

const fetchData = step("fetchData", async (url: string) => {
  const resp = await fetch(url);
  return resp.json();
}, { maxAttempts: 5, retryDelay: 2000 });
```

### `FatalError`

Non-retryable error:

```typescript
import { FatalError } from "@c4c/workflow";
throw new FatalError("This will not be retried");
```

### `RetryableError`

Explicitly retryable error with delay:

```typescript
import { RetryableError } from "@c4c/workflow";
throw new RetryableError("Retry later", { retryAfter: "30s" });
```

### `sleep(duration)`

Durable sleep:

```typescript
import { sleep } from "@c4c/workflow";
await sleep("5s");   // 5 seconds
await sleep("1m");   // 1 minute
await sleep(5000);   // 5000ms
```

### `createHook(options)`

Suspend workflow for external events:

```typescript
import { createHook } from "@c4c/workflow";

const hook = createHook<{ approved: boolean }>({
  token: "approval:123",
  timeout: "24h",
});
const result = await hook;  // Suspends here
```

### `resolveHook(token, payload)`

Resume a suspended workflow:

```typescript
import { resolveHook } from "@c4c/workflow";
resolveHook("approval:123", { approved: true });
```

### `getStepMetadata()`

Access step execution context:

```typescript
import { getStepMetadata } from "@c4c/workflow";
const { attempt, maxAttempts, workflowRunId } = getStepMetadata();
```

### `getWorkflowMetadata()`

Access workflow execution context:

```typescript
import { getWorkflowMetadata } from "@c4c/workflow";
const { workflowRunId, workflowStartedAt } = getWorkflowMetadata();
```

### `getWritable()`

Get writable stream for streaming output:

```typescript
import { getWritable } from "@c4c/workflow";
const writable = getWritable<Uint8Array>();
```

## Event System

### `subscribeToRun(runId, listener)`

Subscribe to events from a specific run:

```typescript
import { subscribeToRun } from "@c4c/workflow";

const unsub = subscribeToRun(run.runId, (event) => {
  console.log(event.type);
});
```

### `subscribeToAll(listener)`

Subscribe to events from all runs:

```typescript
import { subscribeToAll } from "@c4c/workflow";

const unsub = subscribeToAll((event) => {
  console.log(event.type, event.runId);
});
```

## Execution Store

```typescript
import { getExecutionStore } from "@c4c/workflow";

const store = getExecutionStore();
store.getAllRuns();     // Get all run records
store.getRun(runId);   // Get specific run
store.getStats();      // Get run statistics
```

## Types

- `WorkflowRun<T>` - Running workflow instance
- `StepMetadata` - Step execution metadata
- `WorkflowMetadata` - Workflow execution metadata
- `WorkflowEvent` - Event emitted during execution
- `RunRecord` - Persisted run record
- `StepRecord` - Persisted step record
- `Hook<T>` - Hook for workflow suspension
- `StartOptions` - Options for `start()`
