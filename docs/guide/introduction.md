# Introduction

c4c (Code For Coders) is a TypeScript-first workflow automation framework designed for developers who prefer code over visual interfaces.

## What is c4c?

c4c is an alternative to visual workflow tools like n8n, Zapier, or Make, but built specifically for developers. Instead of clicking through UI to build workflows, you write them in TypeScript with full type safety, IDE support, and version control.

## Key Features

### 🚀 Zero Configuration

No configuration files, no hardcoded paths. The framework uses introspection to discover your procedures and workflows automatically.

```typescript
// Just export your procedures - c4c finds them!
export const createUser: Procedure = {
  contract: { input: ..., output: ... },
  handler: async (input) => { ... }
};
```

### 🔒 Type-Safe Everything

Built on TypeScript and Zod, c4c provides compile-time type checking for all your workflows and procedures.

```typescript
// Input and output are fully typed
const result = await client.createUser({
  name: "Alice",
  email: "alice@example.com" 
});
// result is typed as { id: string, name: string, email: string }
```

### 🔄 Auto-Naming

Procedure names are optional. When omitted, c4c uses the export name, enabling IDE refactoring support.

```typescript
// F2 rename works completely!
export const createUser: Procedure = {
  contract: {
    // name = "createUser" automatically
    input: ...,
    output: ...
  },
  handler: ...
};
```

### 📦 Flexible Organization

Organize your code any way you want - flat structure, modules, domain-driven, or monorepo. c4c adapts to your architecture.

```
✅ Flat structure
src/procedures.ts

✅ Modular
src/modules/users/procedures.ts

✅ Domain-driven
domains/billing/commands/

✅ Monorepo
packages/core/procedures/
```

### 📊 OpenTelemetry Integration

Every procedure and workflow execution automatically creates distributed traces for debugging and monitoring.

### 🌲 Git-Friendly

Workflows are just TypeScript files, making them easy to version control, code review, and refactor using standard development tools.

### 🔥 Hot Reload

Development server with instant updates. Changes to procedures and workflows are reflected immediately without restarting.

### 🚀 Multiple Transports

Access your procedures through multiple interfaces:
- **HTTP** - REST and RPC endpoints
- **CLI** - Command-line execution
- **Webhooks** - Event-driven triggers
- **Workflows** - Orchestrate multiple procedures

## When to Use c4c

c4c is ideal for:

- **Backend API development** - Build type-safe APIs with automatic OpenAPI generation
- **Workflow automation** - Orchestrate complex business processes
- **Integration projects** - Connect multiple services and APIs
- **Microservices** - Build and coordinate distributed services
- **Event-driven systems** - Handle webhooks and triggers

## When NOT to Use c4c

c4c might not be the best choice if:

- You prefer visual/no-code tools
- Your team is not familiar with TypeScript
- You need a hosted SaaS solution
- You want a battle-tested enterprise platform (c4c is relatively new)

## Core Concepts

c4c is built around three core concepts:

### 1. Procedures

Procedures are type-safe functions with contracts. They define inputs, outputs, and business logic.

```typescript
export const createUser: Procedure = {
  contract: {
    input: z.object({ name: z.string(), email: z.string() }),
    output: z.object({ id: z.string(), name: z.string(), email: z.string() })
  },
  handler: async (input) => {
    return { id: generateId(), ...input };
  }
};
```

### 2. Workflows

Workflows orchestrate multiple procedures with branching and parallel execution.

```typescript
export default workflow("user-onboarding")
  .step(createUserStep)
  .step(sendWelcomeEmailStep)
  .commit();
```

### 3. Registry

The registry automatically discovers and indexes all procedures and workflows in your project through introspection.

```typescript
const registry = await collectRegistry("./src");
// Automatically finds all procedures and workflows
```

## Architecture

c4c follows a modular architecture:

```
┌─────────────────────────────────────────┐
│           Applications                  │
│    (CLI, HTTP Server, Workflows)        │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│            Adapters                     │
│    (@c4c/adapters - HTTP, REST, CLI)   │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│        Workflow Engine                  │
│      (@c4c/workflow - Runtime)          │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│          Core Framework                 │
│  (@c4c/core - Registry, Execution)      │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│       Your Procedures & Workflows       │
└─────────────────────────────────────────┘
```

## Next Steps

Ready to get started?

- [Quick Start](/guide/quick-start) - Get up and running in minutes
- [Installation](/guide/installation) - Detailed installation instructions
- [Procedures](/guide/procedures) - Learn about procedures
- [Workflows](/guide/workflows) - Build your first workflow
