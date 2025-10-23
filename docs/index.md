---
layout: home

hero:
  name: c4c
  text: Code For Coders
  tagline: TypeScript-first workflow automation framework. Build type-safe procedures and workflows with zero configuration.
  image:
    src: /logo.svg
    alt: c4c
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/Pom4H/c4c

features:
  - icon: ⚡
    title: Zero Config
    details: No hardcoded paths, pure introspection discovers your code automatically. Organize any way you want.
  
  - icon: 🔒
    title: Type-Safe
    details: Full TypeScript support with Zod schema validation. Catch errors at compile time, not runtime.
  
  - icon: 🔄
    title: Auto-Naming
    details: Optional procedure names with IDE refactoring support. F2 to rename works everywhere!
  
  - icon: 📦
    title: Flexible Structure
    details: Organize code any way you want - modules, domains, flat, or monorepo. The framework adapts to you.
  
  - icon: 📊
    title: OpenTelemetry
    details: Automatic distributed tracing for debugging. Every execution creates detailed traces.
  
  - icon: 🌲
    title: Git-Friendly
    details: Workflows are just TypeScript files. Version control, code review, and refactoring work naturally.
  
  - icon: 🔥
    title: Hot Reload
    details: Development server with instant updates. See changes immediately without restarting.
  
  - icon: 🚀
    title: Multiple Transports
    details: HTTP (REST/RPC), CLI, webhooks, workflows - all from the same codebase.
  
  - icon: 🎯
    title: Generated Clients
    details: Generate fully-typed TypeScript clients from your procedures. No manual API integration needed.
---

## Quick Example

### Define a Procedure

```typescript
import { z } from "zod";
import type { Procedure } from "@c4c/core";

export const createUser: Procedure = {
  contract: {
    input: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
  handler: async (input) => {
    return { id: generateId(), ...input };
  }
};
```

### Build a Workflow

```typescript
import { workflow, step } from "@c4c/workflow";

export default workflow("user-onboarding")
  .name("User Onboarding Flow")
  .version("1.0.0")
  .step(step({
    id: "create-user",
    execute: ({ engine, inputData }) => 
      engine.run("users.create", inputData),
  }))
  .step(step({
    id: "send-welcome",
    execute: ({ engine }) => 
      engine.run("emails.sendWelcome"),
  }))
  .commit();
```

### Execute

```bash
# Start dev server
c4c dev

# Execute procedure
c4c exec createUser --input '{"name":"Alice","email":"alice@example.com"}'

# Execute workflow
c4c exec userOnboarding
```

## Why c4c?

### vs Visual Tools (n8n, Zapier, Make)

| Feature | Visual Tools | c4c |
|---------|-------------|-----|
| Development Speed | Click through UI | Type in IDE |
| Version Control | Limited | Full git |
| Type Safety | None | Full TypeScript |
| Testing | Manual | Automated |
| Refactoring | Manual | IDE support |
| Code Reuse | Limited | Full |

### vs Code Frameworks (Temporal, Step Functions)

| Feature | Others | c4c |
|---------|--------|-----|
| Learning Curve | Complex DSLs | Just TypeScript |
| Setup | Configuration heavy | Zero config |
| Organization | Prescribed structure | Any structure |
| Introspection | Limited | Full automatic |
| Developer Tools | CLI, SDKs | Everything built-in |

## Philosophy

**Framework shouldn't dictate architecture.**

c4c embraces introspection over configuration. Organize your code the way that makes sense for your project - the framework will find your procedures and workflows automatically.

**Developer experience first:**
- Type-safe everything
- IDE refactoring support
- Git-friendly workflows
- Hot reload development
- No vendor lock-in

---

**Build workflows like code, not clicks.**
