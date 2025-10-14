# 🔍 Analysis: What Should Be in Framework

## Дублирование Между Примерами

### 1. 🔄 Hono SSE Endpoints (90% совпадение)

**Next.js** (`hono-app.ts`, строки 27-113):
```typescript
app.get("/api/workflows", (c) => { /* list */ });
app.get("/api/workflows/:id", (c) => { /* get */ });
app.post("/api/workflows/:id/execute", async (c) => {
  return streamSSE(c, async (stream) => {
    // SSE logic ~50 lines
  });
});
```

**Bun** (`server.tsx`, строки 225-296):
```typescript
app.get("/api/workflows", (c) => { /* list */ });
app.post("/api/workflows/:id/execute", async (c) => {
  return streamSSE(c, async (stream) => {
    // SSE logic ~50 lines (идентична!)
  });
});
```

**Дублирование**: ~100 строк почти идентичного кода!

---

### 2. 🗂️ Registry Setup (повторяется)

**Next.js** (`registry.ts`):
```typescript
const registry: Registry = new Map();
registry.set("math.add", addProcedure as unknown as Procedure);
registry.set("math.multiply", multiplyProcedure as unknown as Procedure);
// ...
```

**Bun** (`server.tsx`):
```typescript
const registry: Registry = new Map();
registry.set("math.add", addProcedure as unknown as Procedure);
registry.set("math.multiply", multiplyProcedure as unknown as Procedure);
// ...
```

**Дублирование**: Паттерн + кастинг типов

---

### 3. 📦 Demo Procedures (дублируются)

**Обе реализации имеют:**
- `math.add` - идентична
- `math.multiply` - идентична

**Next.js**: 6 procedures  
**Bun**: 3 procedures  
**Overlap**: 2 procedures (100% дублирование)

---

## ✨ Что Должно Быть в Framework

### 1. Hono Adapter для Workflow
**Новый файл**: `src/adapters/hono-workflow.ts`

```typescript
export function createWorkflowApp(
  registry: Registry,
  workflows: Record<string, WorkflowDefinition>,
  options?: { basePath?: string }
): Hono;
```

**Что включает:**
- GET /workflows - список
- GET /workflows/:id - определение
- POST /workflows/:id/execute - SSE execution
- Готовые SSE handlers

**Выгода**: 100 строк кода → 3 строки вызова

---

### 2. Registry Helpers
**Новый файл**: `src/core/registry-helpers.ts`

```typescript
export function createRegistryFromProcedures(
  procedures: Record<string, Procedure>
): Registry;

export function registerProcedures(
  registry: Registry,
  procedures: Record<string, Procedure>
): void;
```

**Выгода**: Убирает необходимость кастинга типов

---

### 3. Demo Procedures
**Новый файл**: `src/examples/procedures.ts`

```typescript
export const mathAdd: Procedure;
export const mathMultiply: Procedure;
export const mathSubtract: Procedure;
export const greet: Procedure;
// etc.
```

**Выгода**: Переиспользуемые demo procedures

---

### 4. Workflow Factory Helpers
**Новый файл**: `src/workflow/factory.ts`

```typescript
export function createSimpleWorkflow(
  id: string,
  procedures: Array<{ name: string; config?: any }>
): WorkflowDefinition;
```

**Выгода**: Упрощает создание простых workflows

---

### 5. SSE Types
**Добавить в**: `src/workflow/types.ts`

```typescript
export interface WorkflowSSEEvent {
  type: "start" | "progress" | "complete" | "error";
  // ...
}
```

**Выгода**: Переиспользуемые типы для SSE

---

## 📊 Impact Analysis

| Component | Lines Duplicated | After Framework | Savings |
|-----------|-----------------|----------------|---------|
| Hono SSE endpoints | ~100 | ~5 | **95 lines** |
| Registry setup | ~15 | ~2 | **13 lines** |
| Demo procedures | ~150 | ~0 | **150 lines** |
| Type casting | ~20 | ~0 | **20 lines** |
| **Total** | **~285** | **~7** | **~278 lines** |

**Savings per example**: ~140 lines  
**With 2 examples**: ~280 lines saved  
**Future examples**: Each saves ~140 lines automatically!

---

## 🎯 Priority

### High Priority (Must Have)
1. ✅ **Hono Workflow Adapter** - устраняет 100+ строк дублирования
2. ✅ **Registry Helpers** - упрощает setup
3. ✅ **Demo Procedures** - переиспользуемые примеры

### Medium Priority (Nice to Have)
4. ⭐ **Workflow Factory** - упрощает создание workflows
5. ⭐ **SSE Types** - стандартизация

### Low Priority (Future)
6. Validation helpers
7. Error handling utilities
8. Middleware factory

---

## 🚀 Implementation Plan

### Phase 1: Hono Adapter (30 min)
```typescript
// src/adapters/hono-workflow.ts
export function createWorkflowApp(registry, workflows) {
  const app = new Hono();
  // Add all endpoints
  return app;
}
```

### Phase 2: Registry Helpers (15 min)
```typescript
// src/core/registry-helpers.ts
export function createRegistryFromProcedures(procedures) {
  const registry = new Map();
  for (const [name, proc] of Object.entries(procedures)) {
    registry.set(name, proc);
  }
  return registry;
}
```

### Phase 3: Demo Procedures (20 min)
```typescript
// src/examples/procedures.ts
export const demoProcedures = {
  mathAdd,
  mathMultiply,
  greet,
  // ...
};
```

### Phase 4: Update Examples (20 min)
```typescript
// Before: 100+ lines
// After: 5 lines
import { createWorkflowApp } from "@tsdev/adapters/hono-workflow";
const app = createWorkflowApp(registry, workflows);
```

---

## ✅ Expected Results

### Before
```typescript
// Example: 285 lines of boilerplate
const registry = new Map();
registry.set("math.add", addProcedure as unknown as Procedure);
// ... 15 lines

const app = new Hono();
app.get("/api/workflows", (c) => { /* ... */ });  // 10 lines
app.get("/api/workflows/:id", (c) => { /* ... */ });  // 15 lines
app.post("/api/workflows/:id/execute", (c) => { /* ... */ });  // 60 lines
```

### After
```typescript
// Example: 7 lines!
import { createWorkflowApp, createRegistryFromProcedures } from "@tsdev/adapters";
import { demoProcedures } from "@tsdev/examples";

const registry = createRegistryFromProcedures(demoProcedures);
const app = createWorkflowApp(registry, workflows);
```

**Reduction**: 285 → 7 lines = **97% less code!**

---

## 🎉 Conclusion

**Framework should include:**
1. ✅ Hono workflow adapter (biggest impact)
2. ✅ Registry helpers (simplifies setup)
3. ✅ Demo procedures (reusable examples)
4. ⭐ Workflow factories (nice to have)
5. ⭐ SSE types (standardization)

**Total Savings**: ~280 lines per example  
**Developer Experience**: Massively improved  
**Framework Completeness**: Much better

**Status**: Ready to implement! 🚀
