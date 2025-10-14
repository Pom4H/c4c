# 🚀 tsdev Framework Examples

Two production-ready examples showing different use cases of tsdev framework.

## 📦 Available Examples

### 1. 🎨 Next.js + React Flow + SSE
**Complex workflow visualization dashboard**

- Location: `examples/nextjs-workflow-viz/`
- Stack: Next.js 15 + React 19 + Hono + tsdev
- Features: React Flow graphs, Trace viewer, Gantt chart, SSE streaming
- Use case: Production dashboards, admin panels, data pipelines

```bash
cd examples/nextjs-workflow-viz
npm install && npm run dev
# → http://localhost:3000
```

### 2. ⚡ Bun + Native JSX + Hono
**Simple, fast workflow execution**

- Location: `examples/bun-workflow/`
- Stack: Bun 1.3 + Hono + tsdev
- Features: Native JSX (no build!), SSE streaming, <50ms startup
- Use case: Prototypes, internal tools, microservices

```bash
cd examples/bun-workflow
bun install && bun run dev
# → http://localhost:3001
```

## 🔑 Key Differences

| Feature | Next.js | Bun |
|---------|---------|-----|
| Complexity | High | Low |
| Build Required | Yes | No |
| Startup Time | ~2s | <50ms |
| Visualization | React Flow | Simple UI |
| Best For | Production | Prototypes |

## 🚀 Both Use tsdev Framework!

```typescript
// React hooks from framework
import { useWorkflow } from "@tsdev/react";

// Core framework
import { executeWorkflow } from "@tsdev/workflow/runtime";
import type { Registry, Procedure } from "@tsdev/core/types";

// Contract-first procedures
const myProcedure: Procedure = {
  contract: {
    name: "my.proc",
    input: z.object({ x: z.number() }),
    output: z.object({ y: z.number() }),
  },
  handler: async (input) => ({ y: input.x * 2 }),
};
```

## 📚 Documentation

- [Examples Overview](./examples/README.md)
- [Next.js Integration](./examples/nextjs-workflow-viz/INTEGRATION_SUMMARY.md)
- [Bun Features](./examples/bun-workflow/FEATURES.md)
- [Framework Refactor](./FRAMEWORK_REFACTOR_COMPLETE.md)

## ✅ Status: Production Ready!
