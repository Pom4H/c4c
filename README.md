# tsdev

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Zod](https://img.shields.io/badge/Zod-Schema-green.svg)](https://zod.dev/)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Enabled-orange.svg)](https://opentelemetry.io/)
[![pnpm](https://img.shields.io/badge/pnpm-workspaces-yellow.svg)](https://pnpm.io/)

> **Write once — describe forever.**  
> Meta-level unification of application code through contracts, not transport or infrastructure.

## 🚀 Quick Start

```bash
# Install pnpm
npm install -g pnpm

# Install dependencies
pnpm install

# Run example
pnpm dev
```

Open http://localhost:3000 to see the workflow visualization example.

## 📦 Monorepo Structure

```
tsdev/
├── packages/
│   └── tsdev/              # 🎯 Core framework package
│       ├── core/
│       │   └── workflow/   # Workflow module with OTEL
│       │       └── react/  # React hooks
│       ├── policies/
│       ├── adapters/
│       └── ...
│
└── examples/
    └── nextjs-workflow-viz/  # Next.js example with React Flow
```

## 🎯 Features

- 🎯 **Contracts-first**: single source of truth for all interfaces
- 🔄 **Transport-agnostic**: one handler works via RPC, REST, CLI, SDK, agents
- 📝 **Self-describing**: automatic introspection and documentation
- 📊 **Telemetry by design**: OpenTelemetry built into the domain model
- 🔀 **Visual Workflows**: procedures become workflow nodes automatically
- 🧩 **Composable**: extensibility through function composition
- 📐 **Convention-driven**: code structure determines automation

## 🏗️ Architecture

### Framework Core (`packages/tsdev`)

```typescript
// Import from tsdev package
import { executeWorkflow } from 'tsdev/core/workflow';
import { useWorkflow } from 'tsdev/core/workflow/react';
import type { Registry, Procedure } from 'tsdev/core';
import { withSpan, withRetry } from 'tsdev/policies';
```

### Workflow System

The workflow module allows composing procedures into visual workflows with:
- ✅ **OTEL tracing** - automatic span creation
- ✅ **React hooks** - `useWorkflow()` for UI integration
- ✅ **API routes** - RESTful workflow execution
- ✅ **Pure UI** - React Flow visualization

## 📖 Documentation

- [PHILOSOPHY.md](./PHILOSOPHY.md) - Core principles and design philosophy
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design

## 🎨 Example Application

The Next.js workflow visualization example demonstrates:
- **Pure UI components** - no business logic in components
- **Framework hooks** - `useWorkflow()` for state management
- **API routes** - backend logic in `/api/workflow/*`
- **OTEL tracing** - automatic span collection and visualization
- **React Flow** - visual workflow representation

```bash
cd examples/nextjs-workflow-viz
pnpm dev
```

## 🛠️ Development

### Install Dependencies
```bash
pnpm install
```

### Run Example
```bash
pnpm dev
```

### Build All Packages
```bash
pnpm build
```

### Lint
```bash
pnpm lint
pnpm lint:fix
```

### Package-Specific Commands
```bash
# Only tsdev
pnpm --filter tsdev build

# Only example
pnpm --filter nextjs-workflow-viz dev
```

## 📦 Package Exports

The `tsdev` package provides clean exports:

| Import | Module |
|--------|--------|
| `tsdev` | Main entry point |
| `tsdev/core` | Core types and registry |
| `tsdev/core/workflow` | Workflow runtime with OTEL |
| `tsdev/core/workflow/react` | React hooks |
| `tsdev/policies` | Composable policies |

## 🏆 Key Benefits

### Contracts-First
```typescript
// Define contract once
const contract = {
  name: "users.create",
  input: z.object({ name: z.string(), email: z.string() }),
  output: z.object({ id: z.string(), name: z.string() }),
};

// Use everywhere: REST, CLI, SDK, Workflows
```

### Transport-Agnostic
```typescript
// Same handler, multiple transports
const handler = async (input) => {
  return await createUser(input);
};

// Available via:
// - REST: POST /users
// - CLI: tsdev users.create --name Alice
// - Workflow: procedure node
// - SDK: client.users.create()
```

### OTEL by Design
```typescript
// Automatic tracing in workflows
const workflow = {
  nodes: [
    { type: "procedure", procedureName: "users.create" },
    { type: "procedure", procedureName: "emails.send" }
  ]
};

// Creates span hierarchy:
// workflow.execute
//   ├─ workflow.node.procedure
//   │  └─ users.create (with policies)
//   └─ workflow.node.procedure
//      └─ emails.send (with policies)
```

## 🎯 Philosophy

1. **Contracts-first** - Contracts are the source of truth
2. **Transport-agnostic** - One handler, multiple adapters
3. **Self-describing** - Automatic introspection for SDKs and agents
4. **Telemetry by default** - Every call is observable
5. **Composable** - Behavior extends via functions, not framework
6. **Convention-driven** - Structure → introspection → automation

## 📚 Related

- [OpenTelemetry](https://opentelemetry.io/) - Observability framework
- [Zod](https://zod.dev/) - Schema validation
- [pnpm](https://pnpm.io/) - Fast, disk space efficient package manager

## 📄 License

MIT

---

**Built with ❤️ using contracts-first architecture**
