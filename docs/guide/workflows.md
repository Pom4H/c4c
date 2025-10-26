# Workflows

Workflows orchestrate multiple procedures with branching, parallel execution, and complex control flow.

> **New**: [Event-driven workflows](/guide/workflow-events) with `workflow.on()` for handling internal and external events.

## What is a Workflow?

A workflow is a series of steps that execute procedures in a specific order. Workflows support:

- **Sequential execution** - Steps run one after another
- **Parallel execution** - Multiple steps run simultaneously
- **Conditional branching** - Different paths based on conditions
- **Context sharing** - Steps can access outputs from previous steps

## Declarative API

Define workflows using a declarative structure:

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
      next: "send-welcome",
    },
    {
      id: "send-welcome",
      type: "procedure",
      procedureName: "emails.sendWelcome",
      config: {
        userId: "{{create-user.id}}",
      },
    },
  ],
};
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

Execute procedures by referencing their names:

```typescript
{
  id: "create-user",
  type: "procedure",
  procedureName: "users.create",
  config: {
    name: "{{input.name}}",
    email: "{{input.email}}"
  }
}
```

## Parallel Execution

Execute multiple steps simultaneously:

```typescript
export const systemSetup: WorkflowDefinition = {
  id: "system-setup",
  name: "System Setup",
  version: "1.0.0",
  startNode: "parallel-setup",
  nodes: [
    {
      id: "parallel-setup",
      type: "parallel",
      config: {
        branches: ["setup-database", "setup-cache", "setup-messaging"],
        waitForAll: true,
      },
    },
    {
      id: "setup-database",
      type: "procedure",
      procedureName: "db.setup",
    },
    {
      id: "setup-cache",
      type: "procedure",
      procedureName: "cache.setup",
    },
    {
      id: "setup-messaging",
      type: "procedure",
      procedureName: "messaging.setup",
    },
  ],
};
```

### Partial Completion

Execute parallel steps but continue if some fail:

```typescript
{
  id: "notify-services",
  type: "parallel",
  config: {
    branches: ["notify-email", "notify-sms", "notify-push"],
    waitForAll: false,
    minSuccess: 1,
  }
}
```

## Conditional Branching

Execute different steps based on conditions:

```typescript
{
  id: "check-plan",
  type: "condition",
  config: {
    expression: "get('create-user').plan === 'premium'",
    trueBranch: "premium-setup",
    falseBranch: "free-setup",
  }
}
```

Full example:

```typescript
export const userOnboarding: WorkflowDefinition = {
  id: "user-onboarding",
  name: "User Onboarding",
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
      type: "procedure",
      procedureName: "features.enablePremium",
    },
    {
      id: "free-setup",
      type: "procedure",
      procedureName: "features.enableFree",
    },
  ],
};
```

## Complex Workflow Example

Here's a complete example with all features:

```typescript
import type { WorkflowDefinition } from "@c4c/workflow";

export const userOnboardingComplete: WorkflowDefinition = {
  id: "user-onboarding-complete",
  name: "User Onboarding Flow",
  version: "1.0.0",
  startNode: "create-user",
  nodes: [
    // Step 1: Create user
    {
      id: "create-user",
      type: "procedure",
      procedureName: "users.create",
      next: "check-plan",
    },
    
    // Step 2: Check user plan
    {
      id: "check-plan",
      type: "condition",
      config: {
        expression: "get('create-user').plan === 'premium'",
        trueBranch: "premium-setup",
        falseBranch: "free-setup",
      },
    },
    
    // Premium user setup (parallel execution)
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
      id: "setup-analytics",
      type: "procedure",
      procedureName: "analytics.setup",
      config: {
        userId: "{{create-user.id}}",
      },
    },
    {
      id: "assign-manager",
      type: "procedure",
      procedureName: "users.assignManager",
      config: {
        userId: "{{create-user.id}}",
      },
    },
    {
      id: "enable-features",
      type: "procedure",
      procedureName: "features.enablePremium",
      config: {
        userId: "{{create-user.id}}",
      },
    },
    
    // Free tier setup
    {
      id: "free-setup",
      type: "procedure",
      procedureName: "users.setupFreeTrial",
      config: {
        userId: "{{create-user.id}}",
      },
      next: "send-welcome",
    },
    
    // Step 3: Send welcome email
    {
      id: "send-welcome",
      type: "procedure",
      procedureName: "emails.sendWelcome",
      config: {
        userId: "{{create-user.id}}",
        email: "{{create-user.email}}",
        name: "{{create-user.name}}",
      },
    },
  ],
};
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
