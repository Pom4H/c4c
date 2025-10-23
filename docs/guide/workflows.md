# Workflows

Workflows orchestrate multiple procedures with branching, parallel execution, and complex control flow.

## What is a Workflow?

A workflow is a series of steps that execute procedures in a specific order. Workflows support:

- **Sequential execution** - Steps run one after another
- **Parallel execution** - Multiple steps run simultaneously
- **Conditional branching** - Different paths based on conditions
- **Context sharing** - Steps can access outputs from previous steps

## Fluent Builder API

The recommended way to define workflows using a fluent builder:

```typescript
import { workflow, step } from "@c4c/workflow";
import { z } from "zod";

export default workflow("user-onboarding")
  .name("User Onboarding Flow")
  .version("1.0.0")
  .step(step({
    id: "create-user",
    input: z.object({ name: z.string(), email: z.string() }),
    output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
    execute: ({ engine, inputData }) => 
      engine.run("users.create", inputData),
  }))
  .step(step({
    id: "send-welcome",
    input: z.object({ userId: z.string() }),
    output: z.object({ sent: z.boolean() }),
    execute: ({ engine, context }) => {
      const user = context.get("create-user");
      return engine.run("emails.sendWelcome", { userId: user.id });
    },
  }))
  .commit();
```

## Basic Step

A step is the smallest unit of execution in a workflow:

```typescript
const myStep = step({
  id: "step-id",
  input: z.object({ ... }),
  output: z.object({ ... }),
  execute: ({ engine, inputData, context }) => {
    // Step logic here
    return { result: "value" };
  },
});
```

### Step Execution Context

The execute function receives a context object:

```typescript
interface StepContext {
  engine: WorkflowEngine;        // Execute procedures
  inputData: any;                // Workflow input data
  context: WorkflowContext;      // Access previous step outputs
}
```

### Accessing Previous Steps

Use `context.get()` to access outputs from previous steps:

```typescript
step({
  id: "process-user",
  execute: ({ context }) => {
    const user = context.get("create-user");
    const email = context.get("send-welcome");
    
    return {
      userId: user.id,
      emailSent: email.sent
    };
  },
})
```

## Running Procedures

Execute procedures within steps using the engine:

```typescript
step({
  id: "create-user",
  execute: ({ engine, inputData }) => {
    // Run a procedure
    return engine.run("users.create", {
      name: inputData.name,
      email: inputData.email
    });
  },
})
```

## Parallel Execution

Execute multiple steps simultaneously:

```typescript
import { parallel } from "@c4c/workflow";

const parallelSetup = parallel({
  id: "parallel-setup",
  branches: [
    step({
      id: "setup-database",
      execute: ({ engine }) => engine.run("db.setup"),
    }),
    step({
      id: "setup-cache",
      execute: ({ engine }) => engine.run("cache.setup"),
    }),
    step({
      id: "setup-messaging",
      execute: ({ engine }) => engine.run("messaging.setup"),
    }),
  ],
  waitForAll: true,  // Wait for all branches to complete
  output: z.object({ setupComplete: z.boolean() }),
});

export default workflow("system-setup")
  .step(parallelSetup)
  .commit();
```

### Partial Completion

Execute parallel steps but continue if some fail:

```typescript
const parallelStep = parallel({
  id: "notify-services",
  branches: [
    step({ id: "notify-email", ... }),
    step({ id: "notify-sms", ... }),
    step({ id: "notify-push", ... }),
  ],
  waitForAll: false,  // Don't wait for all
  minSuccess: 1,      // Continue if at least 1 succeeds
});
```

## Conditional Branching

Execute different steps based on conditions:

```typescript
import { condition } from "@c4c/workflow";

const planCheck = condition({
  id: "check-plan",
  input: z.object({ plan: z.string() }),
  predicate: (context) => {
    const user = context.get("create-user");
    return user.plan === "premium";
  },
  whenTrue: step({
    id: "premium-setup",
    execute: ({ engine }) => engine.run("features.enablePremium"),
  }),
  whenFalse: step({
    id: "free-setup",
    execute: ({ engine }) => engine.run("features.enableFree"),
  }),
});

export default workflow("user-onboarding")
  .step(createUserStep)
  .step(planCheck)
  .commit();
```

## Complex Workflow Example

Here's a complete example with all features:

```typescript
import { workflow, step, parallel, condition } from "@c4c/workflow";
import { z } from "zod";

// Define reusable steps
const createUserStep = step({
  id: "create-user",
  input: z.object({ name: z.string(), email: z.string(), plan: z.string() }),
  output: z.object({ id: z.string(), name: z.string(), email: z.string(), plan: z.string() }),
  execute: ({ engine, inputData }) => 
    engine.run("users.create", inputData),
});

const setupAnalytics = step({
  id: "setup-analytics",
  input: z.object({ userId: z.string() }),
  output: z.object({ trackingId: z.string() }),
  execute: ({ engine, context }) => {
    const user = context.get("create-user");
    return engine.run("analytics.setup", { userId: user.id });
  },
});

const assignManager = step({
  id: "assign-manager",
  input: z.object({ userId: z.string() }),
  output: z.object({ managerId: z.string() }),
  execute: ({ engine, context }) => {
    const user = context.get("create-user");
    return engine.run("users.assignManager", { userId: user.id });
  },
});

const enableFeatures = step({
  id: "enable-features",
  input: z.object({ userId: z.string() }),
  output: z.object({ features: z.array(z.string()) }),
  execute: ({ engine, context }) => {
    const user = context.get("create-user");
    return engine.run("features.enablePremium", { userId: user.id });
  },
});

// Parallel execution for premium users
const premiumSetup = parallel({
  id: "premium-setup",
  branches: [setupAnalytics, assignManager, enableFeatures],
  waitForAll: true,
  output: z.object({ setupComplete: z.boolean() }),
});

// Free tier setup
const freeSetup = step({
  id: "free-setup",
  input: z.object({ userId: z.string() }),
  output: z.object({ trialDays: z.number() }),
  execute: ({ engine, context }) => {
    const user = context.get("create-user");
    return engine.run("users.setupFreeTrial", { userId: user.id });
  },
});

// Conditional branching
const planCheck = condition({
  id: "check-plan",
  input: z.object({ plan: z.string() }),
  predicate: (context) => {
    const user = context.get("create-user");
    return user.plan === "premium";
  },
  whenTrue: premiumSetup,
  whenFalse: freeSetup,
});

// Send welcome email
const sendWelcome = step({
  id: "send-welcome",
  input: z.object({ userId: z.string() }),
  output: z.object({ sent: z.boolean() }),
  execute: ({ engine, context }) => {
    const user = context.get("create-user");
    return engine.run("emails.sendWelcome", { 
      userId: user.id,
      email: user.email,
      name: user.name
    });
  },
});

// Build the complete workflow
export default workflow("user-onboarding")
  .name("User Onboarding Flow")
  .version("1.0.0")
  .step(createUserStep)
  .step(planCheck)
  .step(sendWelcome)
  .commit();
```

## Declarative API

You can also define workflows declaratively:

```typescript
import type { WorkflowDefinition } from "@c4c/workflow";

export const userOnboarding: WorkflowDefinition = {
  id: "user-onboarding",
  name: "User Onboarding Flow",
  version: "1.0.0",
  startNode: "create-user",
  nodes: [
    {
      id: "create-user",
      type: "procedure",
      procedureName: "users.create",
      next: "check-plan",
    },
    {
      id: "check-plan",
      type: "condition",
      config: {
        expression: "get('create-user').plan === 'premium'",
        trueBranch: "premium-setup",
        falseBranch: "free-setup",
      },
    },
    {
      id: "premium-setup",
      type: "parallel",
      config: {
        branches: ["setup-analytics", "assign-manager", "enable-features"],
        waitForAll: true,
      },
      next: "send-welcome",
    },
    {
      id: "free-setup",
      type: "procedure",
      procedureName: "users.setupFreeTrial",
      next: "send-welcome",
    },
    {
      id: "send-welcome",
      type: "procedure",
      procedureName: "emails.sendWelcome",
    },
  ]
};
```

## Workflow Execution

Execute workflows via CLI:

```bash
c4c exec user-onboarding --input '{"name":"Alice","email":"alice@example.com","plan":"premium"}'
```

Or programmatically:

```typescript
import { execute } from "@c4c/core";
import { collectRegistry } from "@c4c/core";

const registry = await collectRegistry("./src");

const result = await execute(
  registry,
  "user-onboarding",
  {
    name: "Alice",
    email: "alice@example.com",
    plan: "premium"
  }
);

console.log(result);
```

## Error Handling

Handle errors in workflows:

```typescript
step({
  id: "risky-operation",
  execute: async ({ engine }) => {
    try {
      return await engine.run("external.api");
    } catch (error) {
      console.error("Operation failed:", error);
      // Return fallback value
      return { success: false, error: error.message };
    }
  },
})
```

## Workflow Context

The workflow context stores outputs from all executed steps:

```typescript
interface WorkflowContext {
  // Get output from a specific step
  get(stepId: string): any;
  
  // Get all step outputs
  getAll(): Record<string, any>;
  
  // Check if step has executed
  has(stepId: string): boolean;
}
```

## Export Styles

Both export styles work:

```typescript
// Default export (recommended)
export default workflow("my-workflow")
  .step(...)
  .commit();

// Named export
export const myWorkflow = workflow("my-workflow")
  .step(...)
  .commit();
```

## Best Practices

1. **Use descriptive IDs** - Make step IDs self-documenting
2. **Keep steps focused** - One step = one responsibility
3. **Use parallel execution** - Speed up independent operations
4. **Handle errors** - Add error handling for external calls
5. **Test workflows** - Write tests for workflow logic
6. **Document complex flows** - Add comments for complex branching
7. **Reuse steps** - Define common steps once
8. **Version workflows** - Use semantic versioning

## Next Steps

- [Learn about the Registry](/guide/registry)
- [Add Policies to Workflows](/guide/policies)
- [Set up OpenTelemetry](/guide/opentelemetry)
- [Build Complex Workflows](/examples/modules)
