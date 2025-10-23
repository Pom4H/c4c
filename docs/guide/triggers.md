# Triggers & Webhooks

Handle events from external services with triggers.

## What are Triggers?

Triggers are special procedures that respond to external events like webhooks.

## Defining Triggers

```typescript
import type { Procedure } from "@c4c/core";

export const githubWebhook: Procedure = {
  contract: {
    name: "github.webhook",
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
    // Handle GitHub push event
    return { processed: true };
  }
};
```

## Webhook Endpoints

When the server starts, webhook endpoints are automatically created:

```
POST /webhooks/github
POST /webhooks/stripe
POST /webhooks/{provider}
```

## Trigger Manager

Manage trigger subscriptions:

```typescript
import { TriggerSubscriptionManager } from "@c4c/core";

const manager = new TriggerSubscriptionManager(registry);

await manager.subscribe("github.webhook", {
  url: "https://example.com/webhook",
  events: ["push", "pull_request"]
});
```

## Next Steps

- [View Core Documentation](/packages/core)
- [Explore Trigger Examples](/examples/triggers)
