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
│   │   └── index.ts
│   │
│   ├── workflow-react/    # @tsdev/workflow-react - React hooks
│   │   └── useWorkflow.ts
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
    │   ├── src/contracts/ # Contract definitions
    │   ├── src/handlers/  # Handler implementations
    │   └── src/apps/      # HTTP server & CLI
    │
    ├── workflows/         # Workflow examples
    │   └── src/           # Mock procedures & workflow definitions
    │
    ├── chat-automation/   # Workflow-driven automation server
    │   └── src/           # System workflow + mock registry
    │
    └── workflow-viz/      # Next.js workflow visualization
        └── src/           # React Flow visualization demo
```

## 🎯 Features

- 🎯 **Contracts-first**: single source of truth for all interfaces
- 🔄 **Transport-agnostic**: one handler works via RPC, REST, CLI, SDK, agents
- 📝 **API generators**: OpenAPI/JSON Schema generated from contracts for clients, docs and mocks
- 🧪 **Self-describing registry**: programmatic introspection for SDKs and agents
- 📊 **Telemetry by design**: OpenTelemetry built into the domain model
- 🔀 **Procedural → Workflow**: procedures compose into visual workflows, runnable by agents
- 🧩 **Composable policies**: cross-cutting concerns via function composition
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

### React Integration (`@tsdev/workflow-react`)

```typescript
import { useWorkflow } from '@tsdev/workflow-react';
```

### Transport Adapters (`@tsdev/adapters`)

```typescript
import { createHttpServer, runCli } from '@tsdev/adapters';
```

### Composable Policies (`@tsdev/policies`)
### Generators (`@tsdev/generators`)

```typescript
import { generateOpenAPISpec, generateOpenAPIJSON } from '@tsdev/generators';
import { collectRegistry } from '@tsdev/core';

const registry = await collectRegistry('./src/handlers');
const spec = generateOpenAPISpec(registry, { title: 'My Service', version: '1.0.0' });
```

Use the generated OpenAPI/JSON Schema to power clients, mocks, documentation sites, and contract tests.


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

### Chat Automation Example
Demonstrates workflow-driven automation:
```bash
cd examples/chat-automation
pnpm install
pnpm dev  # Server on :3002
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

## 🔌 GitHub Integration (delivery via code/workflows and agent edits)

- Use GitHub Actions to generate and publish API docs on each push:

```yaml
name: api-docs
on:
  push:
    branches: [ main ]
jobs:
  generate-openapi:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: |
          node -e "(async () => {
            const { collectRegistry } = await import('./packages/core/dist/index.js');
            const { generateOpenAPIJSON } = await import('./packages/generators/dist/index.js');
            const registry = await collectRegistry('./examples/basic/src/handlers');
            const json = generateOpenAPIJSON(registry, { title: 'tsdev API' });
            await import('node:fs/promises').then(fs => fs.writeFile('openapi.json', json));
          })()"
      - uses: actions/upload-artifact@v4
        with:
          name: openapi
          path: openapi.json
```

- Use PRs as a powerful delivery surface: agents can propose edits to contracts/handlers/workflows; CI validates, regenerates OpenAPI, and previews docs.

- Wire agents to GitHub via a bot token to edit procedures and workflows; the `collectRegistry()`-backed registry stays the single source of truth, ensuring safe automation.

## 📦 Package Exports

### `@tsdev/core`
| Import | Module |
|--------|--------|
| `@tsdev/core` | Core types, registry, executor |

### `@tsdev/workflow`
| Import | Module |
|--------|--------|
| `@tsdev/workflow` | Workflow runtime with OpenTelemetry |

### `@tsdev/workflow-react`
| Import | Module |
|--------|--------|
| `@tsdev/workflow-react` | React hooks for workflows |

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
