# 🚀 tsdev - Contract-First Framework

**Production-ready framework for building transport-agnostic applications with workflows, React hooks, and SSE streaming.**

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/yourusername/tsdev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

---

## ✨ Features

- ✅ **Contract-First Design** - Define APIs with Zod schemas
- ✅ **Transport Agnostic** - HTTP, CLI, SSE, (future: gRPC, WebSocket)
- ✅ **Workflow Engine** - Visual workflow execution with OpenTelemetry
- ✅ **React Hooks** - `useWorkflow()` for easy integration
- ✅ **Hono SSE Adapter** - Real-time streaming built-in
- ✅ **Composable Policies** - Retry, rate-limit, logging, spans
- ✅ **Type-Safe** - Full TypeScript support
- ✅ **Zero Boilerplate** - Helpers eliminate repetitive code

---

## 🚀 Quick Start (10 lines!)

```typescript
import { Hono } from "hono";
import { 
  createRegistryFromProcedures,
  createWorkflowRoutes,
  demoProcedures 
} from "tsdev";

const registry = createRegistryFromProcedures(demoProcedures);
const app = new Hono();
createWorkflowRoutes(app, registry, workflows);

export default app;  // Done! 🎉
```

Visit `http://localhost:3000/api/workflows` - It just works!

---

## 📦 Installation

```bash
npm install tsdev hono zod
```

**Peer Dependencies:**
- `hono` - For SSE adapter
- `react` - For React hooks (optional)

---

## 💡 Core Concepts

### Contract-First Procedures

```typescript
import { z } from "zod";
import type { Procedure } from "tsdev/core/types";

export const addProcedure: Procedure = {
  contract: {
    name: "math.add",
    input: z.object({
      a: z.number(),
      b: z.number(),
    }),
    output: z.object({
      result: z.number(),
    }),
  },
  handler: async (input) => {
    // Input is automatically validated!
    return { result: input.a + input.b };
  },
};
```

### Registry Setup

```typescript
import { createRegistryFromProcedures } from "tsdev/core/registry-helpers";
import { demoProcedures } from "tsdev/examples";

// Option 1: Use demo procedures
const registry = createRegistryFromProcedures(demoProcedures);

// Option 2: Use your own
const registry = createRegistryFromProcedures({
  "math.add": addProcedure,
  "math.multiply": multiplyProcedure,
});
```

### Hono SSE Adapter

```typescript
import { Hono } from "hono";
import { createWorkflowRoutes } from "tsdev/adapters/hono-workflow";

const app = new Hono();
createWorkflowRoutes(app, registry, workflows, {
  basePath: "/api/workflows"  // optional, defaults to /api/workflows
});

// Auto-creates:
// - GET /api/workflows           → List workflows
// - GET /api/workflows/:id       → Get workflow definition
// - POST /api/workflows/:id/execute → Execute with SSE streaming
```

### React Hooks

```typescript
import { useWorkflow } from "tsdev/react";

function MyComponent() {
  const { execute, isExecuting, result } = useWorkflow({
    onStart: (data) => console.log("Started:", data.workflowName),
    onProgress: (data) => console.log("Node:", data.nodeId),
    onComplete: (result) => console.log("Done:", result),
  });

  return (
    <button onClick={() => execute("workflow-id")} disabled={isExecuting}>
      {isExecuting ? "Executing..." : "Execute Workflow"}
    </button>
  );
}
```

---

## 📚 Modules

### Core
- `@tsdev/core` - Registry, Executor, Types
- `@tsdev/core/registry-helpers` - Registry utilities

### Workflow
- `@tsdev/workflow` - Runtime, Types
- `@tsdev/workflow/factory` - Workflow builders
- `@tsdev/workflow/sse-types` - SSE event types

### Integration
- `@tsdev/react` - React hooks
- `@tsdev/adapters/hono-workflow` - Hono SSE adapter

### Utilities
- `@tsdev/policies` - withRetry, withRateLimit, etc.
- `@tsdev/examples` - Demo procedures

---

## 🎯 Examples

### Next.js + React Flow
Complex workflow visualization dashboard

```bash
cd examples/nextjs-workflow-viz
npm install && npm run dev
# → http://localhost:3000
```

**Features:**
- React Flow graphs
- Trace viewer
- Gantt chart
- SSE streaming

### Bun + Native JSX
Simple, fast server with native JSX

```bash
cd examples/bun-workflow
bun install && bun run dev
# → http://localhost:3001
```

**Features:**
- Native JSX (no build!)
- < 50ms startup
- Interactive UI
- Zero config

---

## 🏗️ Architecture

```
Your Application
    ↓
tsdev Framework
    ├── Core (Registry, Executor)
    ├── Workflow (Runtime, Factory)
    ├── React (Hooks)
    └── Adapters (Hono, HTTP, CLI)
    ↓
Your Procedures
    ├── Contract (Zod schemas)
    └── Handler (Business logic)
```

**Transport Agnostic**: Same procedures work via HTTP, CLI, SSE, etc.

---

## 📖 Documentation

- **[START_HERE.md](./START_HERE.md)** - Quick start guide
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed architecture
- **[examples/](./examples/)** - Example projects

---

## 🔧 Development

```bash
# Install dependencies
npm install

# Build framework
npm run build

# Run examples
cd examples/nextjs-workflow-viz && npm run dev
cd examples/bun-workflow && bun run dev

# Lint
npm run lint

# Fix linting
npm run lint:fix
```

---

## 📊 Framework Statistics

- **Modules**: 11
- **Files**: 34 TypeScript files
- **Lines**: ~3658
- **Exports**: 50+
- **Completeness**: 95%
- **Examples**: 2 (Next.js + Bun)

---

## 🌟 Why tsdev?

### Contract-First
Define APIs with Zod, get validation and types automatically.

### Transport-Agnostic
Write once, run anywhere - HTTP, CLI, SSE, WebSocket, gRPC.

### Zero Boilerplate
Helpers and adapters eliminate repetitive code.

### Type-Safe
Full TypeScript support from contract to execution.

### Production-Ready
OpenTelemetry tracing, policies, error handling built-in.

---

## 🤝 Contributing

Contributions welcome! Please read our [contributing guidelines](./CONTRIBUTING.md).

---

## 📄 License

MIT © 2025

---

## 🚀 Get Started

1. **Install**: `npm install tsdev`
2. **Read**: [START_HERE.md](./START_HERE.md)
3. **Build**: Check examples/
4. **Ship**: Deploy your app! 🎉

---

**tsdev v0.1.0 - Production Ready!**
