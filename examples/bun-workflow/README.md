# Bun + tsdev Workflow Example

Simple workflow execution example using **Bun 1.3**, **Hono**, **JSX**, and **tsdev framework**.

## 🚀 Features

- ✅ **Bun 1.3** - Fast JavaScript runtime with native JSX support
- ✅ **Hono** - Fast web framework
- ✅ **SSE Streaming** - Real-time workflow execution updates
- ✅ **tsdev Framework** - Contract-first procedures with validation
- ✅ **Native JSX** - No build step required, Bun renders JSX out of the box
- ✅ **Zero Config** - Just run and go!

## 📦 Quick Start

### Install Bun (if not installed)

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Windows (WSL)
curl -fsSL https://bun.sh/install | bash

# Or via npm
npm install -g bun
```

Verify installation:
```bash
bun --version  # Should show v1.3.x or higher
```

### Run the Example

```bash
# 1. Build tsdev framework first
cd /workspace
npm run build

# 2. Install dependencies
cd examples/bun-workflow
bun install

# 3. Run server
bun run dev

# 4. Open browser
open http://localhost:3001
```

That's it! No build step, no webpack, just run! ⚡

## 🏗️ Architecture

```
Browser
    ↓ Click workflow
    ↓ fetch() with SSE
Bun Server (server.tsx)
    ↓ Hono SSE endpoint
tsdev Framework
    ├── Registry (procedures)
    ├── executeWorkflow()
    └── Contract validation (Zod)
    ↓ SSE stream
Browser
    ↑ Real-time updates
```

## 📋 Demo Procedures

### math.add
```typescript
Input: { a: number, b: number }
Output: { result: number }
Example: 10 + 5 = 15
```

### math.multiply
```typescript
Input: { a: number, b?: number }
Output: { result: number }
Example: 15 × 2 = 30
```

### greet
```typescript
Input: { name: string }
Output: { message: string }
Example: "Hello, World! 👋"
```

## 🔧 Project Structure

```
bun-workflow/
├── src/
│   ├── server.tsx          # Bun server with JSX
│   ├── procedures.ts       # Demo procedures
│   └── workflows.ts        # Workflow definitions
├── package.json
└── README.md
```

## 💡 How It Works

### 1. Define Procedures (Contract-First)

```typescript
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
    return { result: input.a + input.b };
  },
};
```

### 2. Create Workflow

```typescript
export const mathWorkflow: WorkflowDefinition = {
  id: "math-calculation",
  name: "Math Calculation",
  startNode: "add",
  nodes: [
    {
      id: "add",
      type: "procedure",
      procedureName: "math.add",
      config: { a: 10, b: 5 },
      next: "multiply",
    },
    // ...
  ],
};
```

### 3. Setup Registry

```typescript
const registry: Registry = new Map();
registry.set("math.add", addProcedure);
registry.set("math.multiply", multiplyProcedure);
```

### 4. Execute with SSE

```typescript
app.post("/api/workflows/:id/execute", async (c) => {
  return streamSSE(c, async (stream) => {
    const result = await executeWorkflow(workflow, registry, input);
    await stream.writeSSE({
      data: JSON.stringify({ result }),
      event: "workflow-complete",
    });
  });
});
```

### 5. Render UI with JSX

```tsx
app.get("/", (c) => {
  return c.html(
    <html>
      <body>
        <h1>Bun + tsdev Framework</h1>
        <div onclick="executeWorkflow('math-calculation')">
          Math Calculation
        </div>
      </body>
    </html>
  );
});
```

## 🎯 Benefits

| Feature | Benefit |
|---------|---------|
| **Bun Native JSX** | No build step, instant rendering |
| **SSE Streaming** | Real-time progress updates |
| **tsdev Framework** | Contract validation, type safety |
| **Zero Config** | Just run and go |
| **Fast** | Bun is extremely fast |

## 📚 Learn More

- [Bun Documentation](https://bun.sh)
- [Hono Framework](https://hono.dev)
- [tsdev Framework](../../README.md)

---

**Made with ❤️ using Bun 1.3 + tsdev**
