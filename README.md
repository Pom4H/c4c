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
│   ├── core/              # @tsdev/core - Core framework
│   │   ├── types.ts       # Contract, Procedure, Registry
│   │   ├── registry.ts    # Auto-discovery via collectRegistry()
│   │   └── executor.ts    # Procedure execution
│   │
│   ├── workflow/          # @tsdev/workflow - Workflow system
│   │   ├── types.ts       # WorkflowDefinition, WorkflowNode
│   │   ├── runtime.ts     # executeWorkflow() with OpenTelemetry
│   │   └── react/         # @tsdev/workflow/react - React hooks
│   │       └── useWorkflow.ts
│   │
│   ├── adapters/          # @tsdev/adapters - Transport adapters
│   │   ├── http.ts        # HTTP/RPC server
│   │   ├── rest.ts        # RESTful routing
│   │   └── cli.ts         # CLI interface
│   │
│   ├── policies/          # @tsdev/policies - Composable policies
│   │   ├── withSpan.ts    # OpenTelemetry tracing
│   │   ├── withRetry.ts   # Retry logic
│   │   ├── withLogging.ts # Logging
│   │   └── withRateLimit.ts
│   │
│   └── generators/        # @tsdev/generators - Code generation
│       └── openapi.ts     # OpenAPI spec generation
│
└── examples/
    ├── basic/             # Basic usage example
    │   ├── contracts/     # Contract definitions
    │   ├── handlers/      # Handler implementations
    │   └── apps/          # HTTP server & CLI
    │
    ├── workflows/         # Workflow examples
    │   └── src/           # Mock procedures & workflow definitions
    │
    └── workflow-viz/      # Next.js workflow visualization
        └── src/           # React Flow visualization demo
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

### Core Framework (`@tsdev/core`)

```typescript
import { collectRegistry, executeProcedure, type Procedure, type Registry } from '@tsdev/core';
```

### Workflow System (`@tsdev/workflow`)

```typescript
import { executeWorkflow, type WorkflowDefinition } from '@tsdev/workflow';
```

### React Integration (`@tsdev/workflow/react`)

```typescript
import { useWorkflow } from '@tsdev/workflow/react';
```

### Transport Adapters (`@tsdev/adapters`)

```typescript
import { createHttpServer, runCli } from '@tsdev/adapters';
```

### Composable Policies (`@tsdev/policies`)

```typescript
import { withSpan, withRetry, withLogging, withRateLimit } from '@tsdev/policies';
```

## 📖 Documentation

- [PHILOSOPHY.md](./PHILOSOPHY.md) - Core principles and design philosophy
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design

## 🎨 Example Applications

### Basic Example
Demonstrates contracts-first development:
```bash
cd examples/basic
pnpm install
pnpm dev  # HTTP server on :3000
```

### Workflow Example
Demonstrates workflow execution:
```bash
cd examples/workflows
pnpm install
pnpm dev  # Workflow server on :3001
```

### Workflow Visualization
Next.js app with React Flow visualization:
```bash
cd examples/workflow-viz
pnpm install
pnpm dev  # Next.js on :3000
```

## 🛠️ Development

### Install Dependencies
```bash
pnpm install
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

### Run Examples
```bash
pnpm dev              # Workflow visualization
pnpm dev:basic        # Basic HTTP/CLI example
pnpm dev:workflows    # Workflow examples
```

## 📦 Package Exports

### `@tsdev/core`
| Import | Module |
|--------|--------|
| `@tsdev/core` | Core types, registry, executor |

### `@tsdev/workflow`
| Import | Module |
|--------|--------|
| `@tsdev/workflow` | Workflow runtime with OpenTelemetry |
| `@tsdev/workflow/react` | React hooks for workflows |

### `@tsdev/adapters`
| Import | Module |
|--------|--------|
| `@tsdev/adapters` | HTTP, REST, CLI adapters |

### `@tsdev/policies`
| Import | Module |
|--------|--------|
| `@tsdev/policies` | Retry, logging, tracing, rate limiting |

### `@tsdev/generators`
| Import | Module |
|--------|--------|
| `@tsdev/generators` | OpenAPI spec generation |

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

### OpenTelemetry by Design
```typescript
// Automatic tracing in workflows
const workflow = {
  nodes: [
    { type: "procedure", procedureName: "users.create" },
    { type: "procedure", procedureName: "emails.send" }
  ]
};

// Creates span hierarchy automatically
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
