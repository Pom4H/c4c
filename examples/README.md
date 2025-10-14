# tsdev Framework Examples

Two production-ready examples demonstrating different use cases of the tsdev framework.

## 📦 Examples

### 1. Next.js + React Flow + SSE
**Location:** `nextjs-workflow-viz/`

**Best For:**
- Complex workflow visualization
- Production dashboards
- Admin panels
- Data pipelines UI

**Features:**
- ✅ React Flow graph visualization
- ✅ OpenTelemetry trace viewer
- ✅ Span Gantt chart
- ✅ Real-time SSE updates
- ✅ Beautiful Tailwind UI

**Stack:**
- Next.js 15
- React 19
- Hono (for SSE)
- React Flow
- tsdev framework

[→ View Next.js Example](./nextjs-workflow-viz/)

---

### 2. Bun + Hono + Native JSX
**Location:** `bun-workflow/`

**Best For:**
- Quick prototypes
- Internal tools
- Microservices
- Simple APIs
- Fast iteration

**Features:**
- ⚡ Native JSX rendering (no build!)
- ⚡ Blazing fast Bun runtime
- 🚀 Hono SSE streaming
- 🎨 Interactive UI
- 📦 Zero configuration

**Stack:**
- Bun 1.3
- Hono
- Native JSX
- tsdev framework

[→ View Bun Example](./bun-workflow/)

---

## 🚀 Quick Start

### Next.js Example
```bash
# Build framework
cd /workspace
npm run build

# Run example
cd examples/nextjs-workflow-viz
npm install
npm run dev

# Open http://localhost:3000
```

### Bun Example
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Build framework
cd /workspace
npm run build

# Run example
cd examples/bun-workflow
bun install
bun run dev

# Open http://localhost:3001
```

---

## 🎯 Which Example to Use?

### Choose Next.js if you need:
- ✅ Complex visualization
- ✅ Production dashboard
- ✅ React ecosystem
- ✅ SSR/SSG features
- ✅ Enterprise-grade UI

### Choose Bun if you need:
- ⚡ Fast prototyping
- ⚡ Simple API server
- ⚡ Minimal setup
- ⚡ Native TypeScript/JSX
- ⚡ Quick iteration

---

## 📊 Comparison

| Feature | Next.js | Bun |
|---------|---------|-----|
| **UI Complexity** | High | Low |
| **Build Step** | Required | None |
| **Startup Time** | ~2s | <50ms |
| **Bundle Size** | 163KB | N/A |
| **Learning Curve** | Moderate | Easy |
| **Best For** | Production | Prototypes |

---

## 🏗️ Architecture

Both examples use the same tsdev framework core:

```
Your App
    ↓
tsdev Framework
    ├── Core (Registry, Executor, Types)
    ├── Workflow (Runtime, Types)
    ├── React (Hooks) - for Next.js
    └── Adapters (HTTP, CLI)
    ↓
Your Procedures
    ├── Contract (Zod schemas)
    └── Handler (Business logic)
```

---

## 📚 Documentation

### Next.js Example
- [Integration Summary](./nextjs-workflow-viz/INTEGRATION_SUMMARY.md)
- [Framework Integration](./nextjs-workflow-viz/REAL_FRAMEWORK_INTEGRATION.md)
- [Hono SSE Details](./nextjs-workflow-viz/HONO_SSE_INTEGRATION.md)

### Bun Example
- [Quick Start](./bun-workflow/README.md)
- [Features Guide](./bun-workflow/FEATURES.md)

### Framework
- [Main README](../README.md)
- [Framework Refactor](../FRAMEWORK_REFACTOR_COMPLETE.md)
- [Final Summary](../FINAL_REFACTOR_SUMMARY.md)

---

## 🎓 Learning Path

1. **Start with Bun example** - Simple and fast to understand
2. **Explore Next.js example** - See advanced features
3. **Read framework docs** - Understand the core
4. **Build your own** - Use examples as templates

---

## 💡 Common Patterns

### Creating a Procedure
```typescript
import { z } from "zod";
import type { Procedure } from "@tsdev/core/types";

export const myProcedure: Procedure = {
  contract: {
    name: "my.procedure",
    input: z.object({ x: z.number() }),
    output: z.object({ y: z.number() }),
  },
  handler: async (input) => {
    return { y: input.x * 2 };
  },
};
```

### Using in React (Next.js)
```typescript
import { useWorkflow } from "@tsdev/react";

const { execute } = useWorkflow({
  onComplete: (result) => console.log(result),
});

<button onClick={() => execute("workflow-id")}>
  Execute
</button>
```

### Using in Bun (Server)
```typescript
import { executeWorkflow } from "@tsdev/workflow/runtime";

const result = await executeWorkflow(workflow, registry, input);
```

---

## 🚀 Next Steps

1. Choose your preferred example
2. Follow the quick start guide
3. Modify demo procedures
4. Build your application!

---

**Happy coding with tsdev! 🎉**
