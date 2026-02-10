# Workflows

Workflows orchestrate multiple steps using plain TypeScript async functions, inspired by [useworkflow.dev](https://useworkflow.dev) (Vercel Workflow DevKit).

## What is a Workflow?

A workflow is an async function that composes durable steps. Workflows support:

- **Sequential execution** - Steps run one after another with `await`
- **Parallel execution** - Multiple steps run simultaneously with `Promise.all()`
- **Conditional branching** - Use standard `if/else` and `switch`
- **Error handling** - Use `try/catch` with `FatalError` and `RetryableError`
- **Automatic retries** - Steps automatically retry on failure
- **Durable sleep** - `sleep()` survives process restarts
- **Hooks** - Suspend workflow for external events (webhooks, approvals)

## Quick Start

```typescript
import { start, step, FatalError } from "@c4c/workflow";

// Define steps with automatic retry semantics
const fetchUser = step("fetchUser", async (userId: string) => {
  const resp = await fetch(`/api/users/${userId}`);
  if (!resp.ok) throw new Error("Failed to fetch user");
  return resp.json();
});

const sendEmail = step("sendEmail", async (email: string, subject: string) => {
  // If this fails, it will be retried automatically
  await emailService.send({ to: email, subject });
  return { sent: true };
});

// Define workflow - just a plain async function!
export async function onboardUser(userId: string) {
  "use workflow";

  const user = await fetchUser(userId);
  await sendEmail(user.email, "Welcome!");
  return { user, onboarded: true };
}

// Start the workflow
const run = start(onboardUser, ["user_123"]);
const result = await run.result;
```

## Steps

Steps are the building blocks of workflows. They wrap functions with automatic retry semantics.

```typescript
import { step } from "@c4c/workflow";

const add = step("math.add", async (a: number, b: number) => {
  return a + b;
});

// Configure retry behavior
const callAPI = step("callExternalAPI", async (url: string) => {
  const resp = await fetch(url);
  return resp.json();
}, {
  maxAttempts: 5,     // Retry up to 5 times (default: 3)
  retryDelay: 2000,   // Base retry delay in ms (default: 1000)
});
```

### Step Metadata

Access step metadata inside a step function:

```typescript
import { step, getStepMetadata, RetryableError } from "@c4c/workflow";

const myStep = step("myStep", async () => {
  const { attempt, maxAttempts } = getStepMetadata();
  console.log(`Attempt ${attempt} of ${maxAttempts}`);

  if (attempt === 1) {
    throw new RetryableError("Retry me!", { retryAfter: "5s" });
  }

  return "Success";
});
```

## Error Handling

### FatalError - Non-Retryable

When a step throws `FatalError`, it will NOT be retried:

```typescript
import { step, FatalError } from "@c4c/workflow";

const processPayment = step("payment", async (amount: number) => {
  if (amount <= 0) {
    throw new FatalError("Invalid payment amount");
  }
  // Process payment...
});
```

### RetryableError - Explicit Retry

Control retry timing explicitly:

```typescript
import { step, RetryableError } from "@c4c/workflow";

const callAPI = step("callAPI", async () => {
  const resp = await fetch("https://api.example.com");
  if (resp.status === 429) {
    throw new RetryableError("Rate limited", { retryAfter: "30s" });
  }
  return resp.json();
});
```

### Regular Errors - Automatic Retry

Regular errors are automatically retried with exponential backoff:

```typescript
const fetchData = step("fetchData", async () => {
  // If this throws, it will be retried automatically
  // up to maxAttempts with exponential backoff
  const resp = await fetch("https://api.example.com");
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
});
```

### try/catch in Workflows

Catch errors at the workflow level:

```typescript
export async function resilientWorkflow() {
  "use workflow";

  try {
    await riskyStep();
  } catch (error) {
    console.log("Step failed after all retries:", error);
    await fallbackStep();
  }
}
```

## Parallel Execution

Use `Promise.all()` for parallel execution:

```typescript
export async function setupWorkflow() {
  "use workflow";

  // Run three steps in parallel
  const [db, cache, messaging] = await Promise.all([
    setupDatabase(),
    setupCache(),
    setupMessaging(),
  ]);

  console.log("All services ready:", { db, cache, messaging });
  return { db, cache, messaging };
}
```

### Promise.race

Use `Promise.race()` to get the fastest response:

```typescript
export async function fetchWithFallback() {
  "use workflow";

  const result = await Promise.race([
    fetchFromPrimary(),
    fetchFromSecondary(),
    sleep("10s").then(() => ({ source: "timeout", data: null })),
  ]);

  return result;
}
```

## Conditional Logic

Use standard JavaScript `if/else` and `switch`:

```typescript
export async function onboardUser(userId: string) {
  "use workflow";

  const user = await fetchUser(userId);

  // Conditional logic - just JavaScript!
  if (user.plan === "premium") {
    await Promise.all([
      setupAnalytics(userId),
      assignManager(userId),
      enablePremiumFeatures(userId),
    ]);
  } else {
    await setupFreeTrial(userId);
  }

  await sendWelcomeEmail(user.email, user.name);
  return { user, onboarded: true };
}
```

## Durable Sleep

Pause workflows for specified durations:

```typescript
import { sleep } from "@c4c/workflow";

export async function scheduledWorkflow() {
  "use workflow";

  await processFirst();
  await sleep("5m");     // Wait 5 minutes
  await processSecond();
  await sleep("1h");     // Wait 1 hour
  await processThird();
}
```

Supported formats: `"5s"`, `"1m"`, `"2h"`, `"1d"`, or number (milliseconds).

## Hooks (Suspend/Resume)

Suspend a workflow until an external event occurs:

```typescript
import { createHook, resolveHook } from "@c4c/workflow";

export async function approvalWorkflow(orderId: string) {
  "use workflow";

  await prepareOrder(orderId);

  // Create a hook - the workflow suspends here
  const hook = createHook<{ approved: boolean; reviewer: string }>({
    token: `approval:${orderId}`,
    timeout: "24h",
  });

  // Send email with approval link that includes hook.token
  await sendApprovalEmail(orderId, hook.token);

  // Workflow suspends until hook is resolved
  const { approved, reviewer } = await hook;

  if (approved) {
    await processOrder(orderId);
  } else {
    await cancelOrder(orderId);
  }

  return { orderId, approved, reviewer };
}

// External system resolves the hook:
// resolveHook("approval:order_123", { approved: true, reviewer: "alice" });
```

## Streaming

Stream data from workflows:

```typescript
import { getWritable } from "@c4c/workflow";

export async function streamingWorkflow() {
  "use workflow";

  const writable = getWritable<Uint8Array>();
  const writer = writable.getWriter();

  for (let i = 0; i < 10; i++) {
    await writer.write(new TextEncoder().encode(`chunk ${i}\n`));
    await sleep("1s");
  }

  await writer.close();
}
```

## Workflow Metadata

Access workflow metadata:

```typescript
import { getWorkflowMetadata } from "@c4c/workflow";

export async function myWorkflow() {
  "use workflow";

  const { workflowRunId, workflowStartedAt } = getWorkflowMetadata();
  console.log(`Run ${workflowRunId} started at ${workflowStartedAt}`);
}
```

## Starting Workflows

### Programmatically

```typescript
import { start } from "@c4c/workflow";

// Start and wait for result
const run = start(myWorkflow, ["arg1", "arg2"]);
const result = await run.result;

// Start with custom options
const run2 = start(myWorkflow, ["arg1"], {
  runId: "custom-run-id",
  maxStepRetries: 5,
  retryDelay: 2000,
});
```

### Via HTTP API

```bash
curl -X POST http://localhost:3000/workflow/start \
  -H "Content-Type: application/json" \
  -d '{"workflow": "onboardUser", "args": ["user_123"]}'
```

## Monitoring

### Event System

Subscribe to workflow events:

```typescript
import { subscribeToRun, subscribeToAll } from "@c4c/workflow";

// Subscribe to a specific run
const unsub = subscribeToRun(run.runId, (event) => {
  console.log(event.type, event);
});

// Subscribe to all runs
const unsubAll = subscribeToAll((event) => {
  console.log(event.type, event);
});
```

### Execution Store

Query run history:

```typescript
import { getExecutionStore } from "@c4c/workflow";

const store = getExecutionStore();
const runs = store.getAllRuns();
const stats = store.getStats();
```

## Migration from Old DSL

The old DAG-based `WorkflowDefinition` has been replaced with plain async functions:

| Old Pattern | New Pattern |
|---|---|
| `WorkflowDefinition` objects | `async function` with `"use workflow"` |
| `{ type: "procedure", procedureName: "..." }` nodes | `step("name", fn)` |
| `{ type: "parallel", branches: [...] }` | `Promise.all([...])` |
| `{ type: "condition", trueBranch, falseBranch }` | `if/else` |
| `node.next = "nextNode"` | Sequential `await` |
| `workflow().step().commit()` builder | Plain function composition |
| `executeWorkflow(definition, registry, input)` | `start(workflowFn, args)` |

## Best Practices

1. **Write plain functions** - Workflows are just async functions
2. **Use steps for side effects** - Wrap API calls, DB queries in steps for retry
3. **Use Promise.all for parallelism** - Standard JavaScript patterns work
4. **Throw FatalError for non-retryable failures** - Don't retry invalid input
5. **Use createHook for external events** - Webhooks, approvals, callbacks
6. **Keep workflows focused** - One workflow per business process
7. **Test like regular functions** - Workflows are testable without special setup

## Next Steps

- [Learn about Procedures](/guide/procedures)
- [Set up Triggers](/guide/triggers)
- [Use the HTTP API](/guide/http-api)
- [View Examples](/examples/basic)
