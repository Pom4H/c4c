# c4c

Workflow DevKit for TypeScript, powered by [useworkflow.dev](https://useworkflow.dev).

Write durable workflows as plain async functions. Steps retry automatically. Workflows survive restarts.

## Quick Start

```bash
pnpm install
```

### 1. Write a workflow

```typescript
// workflows/onboarding.ts
import { sleep, createWebhook, FatalError } from "workflow";

async function createUser(email: string) {
  "use step";
  const res = await fetch("https://api.example.com/users", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("API error");  // auto-retried
  return res.json();
}

async function sendEmail(to: string, subject: string) {
  "use step";
  await emailService.send({ to, subject });
}

export async function onboardUser(email: string) {
  "use workflow";

  const user = await createUser(email);
  await sleep("5m");
  await sendEmail(email, "Welcome!");

  // Wait for external event (webhook)
  const webhook = createWebhook();
  await sendEmail(email, `Confirm: ${webhook.url}`);
  await webhook;  // workflow sleeps until POST hits webhook.url

  return { userId: user.id, status: "onboarded" };
}
```

### 2. Build

```bash
npx workflow build
```

### 3. Run

```bash
npx c4c dev
```

## Patterns

Everything is standard JavaScript. No DSL, no config objects.

```typescript
// Sequential
const a = await step1();
const b = await step2(a);

// Parallel
const [x, y, z] = await Promise.all([step1(), step2(), step3()]);

// Race
const winner = await Promise.race([fast(), slow()]);

// Conditional
if (amount > 100) {
  await requireApproval();
}

// Loop
for (const item of items) {
  await processItem(item);
}

// Error handling
try {
  await riskyStep();
} catch (e) {
  await fallback();
}

// Non-retryable error
throw new FatalError("invalid input");

// Durable sleep
await sleep("1h");

// Wait for external event
const wh = createWebhook();
await wh;
```

## Architecture

```
workflows/*.ts          "use workflow" / "use step" source files
       ↓
npx workflow build      SWC compiler transforms directives
       ↓
.well-known/workflow/v1/
  flow.js               workflow orchestration (sandboxed VM)
  step.js               step execution (full Node.js)
  webhook.js            webhook delivery
       ↓
HTTP server             POST /.well-known/workflow/v1/{flow,step,webhook}
       ↓
@workflow/world-local   file-based storage (dev)
```

## Project Structure

```
packages/
  workflow/      → re-exports from "workflow" npm package
  adapters/      → HTTP server for .well-known endpoints
apps/
  cli/           → c4c dev / c4c build / c4c serve
examples/
  basic/         → simple workflow examples
tests/
  workflow-integration/  → 22 end-to-end tests
```

## CLI

```bash
c4c dev          # build + start dev server
c4c build        # build workflow bundles
c4c serve        # start production server
```

## Tests

```bash
cd tests/workflow-integration
pnpm run build:workflows    # build test workflows
pnpm test                   # 22 tests: build → handlers → server → execution
```

## Documentation

Full Workflow DevKit docs: [useworkflow.dev](https://useworkflow.dev)

## License

MIT
