# 🎉 Next.js Workflow Visualizer with Real tsdev Framework

**Полноценный пример использования tsdev framework** с React hooks, Hono SSE и OpenTelemetry!

## 🚀 Главные Фичи

### ✅ Реальный tsdev Framework
- **Contract-First Procedures** с Zod validation
- **Real Registry** вместо mock
- **Real OpenTelemetry** traces
- **Production-ready** architecture

### ✅ React Hooks для Workflow
```typescript
const { execute, isExecuting, result } = useWorkflow({
  onStart: (data) => console.log("Started"),
  onProgress: (data) => console.log("Node:", data.nodeId),
  onComplete: (result) => console.log("Done!"),
});

await execute("math-calculation", { a: 10, b: 5 });
```

### ✅ Hono SSE Streaming
- Real-time workflow execution updates
- Server-Sent Events для progress tracking
- Интеграция напрямую в Next.js API routes

### ✅ Beautiful UI
- React Flow visualization
- Span Gantt Chart  
- Trace Details Viewer
- Modern Tailwind CSS

## 📦 Quick Start

### 1. Build tsdev Framework

```bash
cd /workspace
npm install
npm run build
```

### 2. Run Next.js App

```bash
cd examples/nextjs-workflow-viz
npm install
npm run dev
```

Open http://localhost:3000

## 📚 Documentation

- **[INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md)** - Полное описание интеграции
- **[REAL_FRAMEWORK_INTEGRATION.md](./REAL_FRAMEWORK_INTEGRATION.md)** - Technical details
- **[HONO_SSE_INTEGRATION.md](./HONO_SSE_INTEGRATION.md)** - SSE implementation  
- **[MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)** - Server Actions → Hono SSE

## 🏗️ Architecture

```
React Component
    ↓ useWorkflow() hook
Hono SSE Endpoint  
    ↓ runtime-integration.ts
tsdev Framework
    ↓ executeWorkflow()
Registry + Procedures
    ↓ Contract validation
OpenTelemetry Traces
```

## 💡 Example Usage

### Create Procedure

```typescript
export const myProc: Procedure<{ x: number }, { y: number }> = {
  contract: {
    name: "my.procedure",
    input: z.object({ x: z.number() }),
    output: z.object({ y: z.number() }),
  },
  handler: async (input) => ({ y: input.x * 2 }),
};
```

### Register

```typescript
registry.set("my.procedure", myProc as unknown as Procedure);
```

### Use in React

```typescript
const { execute } = useWorkflow({
  onComplete: (result) => alert("Done!"),
});

<button onClick={() => execute("my-workflow")}>
  Execute
</button>
```

## 🎯 Key Files

- `src/hooks/useWorkflow.ts` - React hooks для workflow
- `src/lib/registry.ts` - Registry setup
- `src/lib/procedures/` - Contract-first procedures
- `src/lib/workflow/runtime-integration.ts` - Framework integration
- `src/lib/workflow/hono-app.ts` - Hono SSE endpoints

## 🔧 Tech Stack

- **Next.js 15** - React framework
- **Hono** - Fast web framework with SSE
- **tsdev** - Contract-first framework
- **Zod** - Schema validation
- **OpenTelemetry** - Distributed tracing
- **React Flow** - Graph visualization
- **Tailwind CSS** - Styling

## ✨ Benefits

| Before (Mock) | After (Real Framework) |
|--------------|----------------------|
| ❌ Hardcoded | ✅ Contract-first |
| ❌ No validation | ✅ Zod validation |
| ❌ Mock OTEL | ✅ Real OTEL |
| ❌ Not production-ready | ✅ Production-ready |

## 📊 Statistics

- **16 TypeScript files**
- **~500 lines of новые коде**
- **Build time**: 4.5s
- **Bundle size**: 163 KB

## 🎓 Learn More

1. **Framework Integration**: [INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md)
2. **React Hooks API**: [REAL_FRAMEWORK_INTEGRATION.md](./REAL_FRAMEWORK_INTEGRATION.md)
3. **SSE Implementation**: [HONO_SSE_INTEGRATION.md](./HONO_SSE_INTEGRATION.md)

---

**Status**: ✅ Production Ready  
**Framework**: tsdev (Real, not mock!)  
**Integration**: Complete with React hooks
