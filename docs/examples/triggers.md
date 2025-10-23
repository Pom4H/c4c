# Triggers Example

Example demonstrating webhook triggers and event handling.

## Overview

This example shows:
- Defining webhook triggers
- Handling external events
- Trigger subscriptions
- Event-driven workflows

## Location

```
examples/triggers/
├── src/
│   ├── triggers/
│   │   ├── github.ts
│   │   ├── stripe.ts
│   │   └── custom.ts
│   └── workflows/
├── package.json
└── README.md
```

## GitHub Trigger

```typescript
export const githubPush: Procedure = {
  contract: {
    name: "github.push",
    input: z.object({ ... }),
    output: z.object({ ... }),
    metadata: {
      trigger: {
        provider: "github",
        event: "push"
      }
    }
  },
  handler: async (input) => {
    // Handle push event
    return { processed: true };
  }
};
```

## Webhook Endpoint

```
POST /webhooks/github
```

## Next Steps

- [Learn about Triggers](/guide/triggers)
- [View Core Documentation](/packages/core)
