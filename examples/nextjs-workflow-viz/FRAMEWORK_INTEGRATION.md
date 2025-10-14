# Интеграция с tsdev Framework

## 🔍 Текущая Ситуация

**Пример nextjs-workflow-viz сейчас является standalone демо** и **НЕ использует** основной tsdev фреймворк напрямую.

### Почему так?

Пример был создан как самодостаточное демо для демонстрации концепций:
- ✅ Работает независимо без настройки tsdev
- ✅ Простая установка: `npm install && npm run dev`
- ✅ Легко понять и модифицировать
- ✅ Не требует знания полного tsdev API

### Что используется вместо фреймворка?

**Mock Implementation** в `src/lib/workflow/runtime.ts`:

```typescript
// Упрощенная реализация workflow runtime
class TraceCollector {
  // Простой in-memory trace collector
  // Вместо реального OpenTelemetry
}

// Mock procedures вместо реального Registry
const mockProcedures: Record<string, Function> = {
  "math.add": async (input) => { /* ... */ },
  "math.multiply": async (input) => { /* ... */ },
  // ...
};

// Упрощенный workflow executor
export async function executeWorkflow(
  workflow: WorkflowDefinition,
  initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
  // Выполнение без Registry, без реальных contracts
}
```

## 🔄 Сравнение: Mock vs Real Framework

### Mock Implementation (текущая)

**Файл**: `examples/nextjs-workflow-viz/src/lib/workflow/runtime.ts`

```typescript
// ❌ Нет contracts
// ❌ Нет валидации через Zod
// ❌ Нет Registry
// ❌ Нет policies (withRetry, withRateLimit, etc.)
// ✅ Простая реализация
// ✅ In-memory trace collector
// ✅ Hardcoded mock procedures

const mockProcedures = {
  "math.add": async (input) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { result: input.a + input.b };
  }
};
```

### Real tsdev Framework

**Файл**: `src/workflow/runtime.ts` (основной проект)

```typescript
// ✅ Полная интеграция с Registry
// ✅ Contract-first подход (Zod schemas)
// ✅ Валидация input/output
// ✅ Policies (retry, rate-limit, logging)
// ✅ Реальный OpenTelemetry tracer
// ✅ Transport-agnostic procedures

import { executeProcedure, createExecutionContext } from "../core/executor.js";
import type { Registry } from "../core/types.js";

export async function executeWorkflow(
  workflow: WorkflowDefinition,
  registry: Registry,  // ← Реальный Registry!
  initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
  // Использует registry.get(procedureName)
  // Валидация через contracts
  // Применение policies
}
```

## 🔌 Как Интегрировать Реальный Framework

### Вариант 1: Monorepo с Workspace (Рекомендуется)

**Шаг 1**: Создать workspace в корневом `package.json`:

```json
{
  "name": "tsdev",
  "workspaces": [
    ".",
    "examples/nextjs-workflow-viz"
  ]
}
```

**Шаг 2**: Добавить tsdev как зависимость в `examples/nextjs-workflow-viz/package.json`:

```json
{
  "dependencies": {
    "tsdev": "workspace:*",
    // ... другие зависимости
  }
}
```

**Шаг 3**: Переписать `runtime.ts` для использования реального Registry:

```typescript
// examples/nextjs-workflow-viz/src/lib/workflow/runtime.ts
import { executeWorkflow as executeWorkflowCore } from "tsdev/workflow";
import { createRegistry } from "tsdev/core";
import { mathAdd, mathMultiply } from "./procedures";

// Создаем реальный Registry с процедурами
const registry = createRegistry();
registry.register("math.add", mathAdd);
registry.register("math.multiply", mathMultiply);
// ...

export async function executeWorkflow(
  workflow: WorkflowDefinition,
  initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
  // Используем реальный executor из framework
  return executeWorkflowCore(workflow, registry, initialInput);
}
```

**Шаг 4**: Создать реальные procedures с contracts:

```typescript
// examples/nextjs-workflow-viz/src/lib/workflow/procedures.ts
import { z } from "zod";
import type { Procedure } from "tsdev/core";

export const mathAdd: Procedure<{ a: number; b: number }, { result: number }> = {
  contract: {
    input: z.object({
      a: z.number(),
      b: z.number(),
    }),
    output: z.object({
      result: z.number(),
    }),
  },
  handler: async (input, ctx) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { result: input.a + input.b };
  },
};

export const mathMultiply: Procedure = {
  contract: {
    input: z.object({
      a: z.number(),
      b: z.number().optional(),
    }),
    output: z.object({
      result: z.number(),
    }),
  },
  handler: async (input, ctx) => {
    await new Promise(resolve => setTimeout(resolve, 600));
    const b = input.b ?? 1;
    return { result: input.a * b };
  },
};
```

### Вариант 2: Импорт как npm пакет

**Шаг 1**: Опубликовать tsdev в npm или локальный registry

**Шаг 2**: Установить:

```bash
cd examples/nextjs-workflow-viz
npm install tsdev@latest
```

**Шаг 3**: Использовать так же как в Варианте 1

### Вариант 3: Прямой импорт (для разработки)

```typescript
// Импорт напрямую из корня проекта
import { executeWorkflow } from "../../../src/workflow/runtime.js";
import { createRegistry } from "../../../src/core/registry.js";
import type { Registry } from "../../../src/core/types.js";
```

⚠️ **Проблемы**:
- Разные package.json (может быть конфликт версий зависимостей)
- Сложные пути импорта
- TypeScript path mapping нужно настроить

## 🎯 Преимущества Интеграции с Real Framework

### Что вы получите:

1. **Contract-First Validation**
   ```typescript
   // Автоматическая валидация входов/выходов
   const result = await executeProcedure(procedure, input, ctx);
   // ✅ Input проверен по schema
   // ✅ Output проверен по schema
   // ❌ Выброс ошибки при невалидных данных
   ```

2. **Policies Из Коробки**
   ```typescript
   import { withRetry, withRateLimit, withLogging } from "tsdev/policies";
   
   const procedure = {
     contract: { /* ... */ },
     handler: withRetry(
       withRateLimit(
         withLogging(async (input, ctx) => {
           // Ваша логика
         })
       )
     ),
   };
   ```

3. **Transport Agnostic**
   ```typescript
   // Те же процедуры работают через:
   // - HTTP/REST
   // - CLI
   // - WebSocket (будущее)
   // - gRPC (будущее)
   ```

4. **Real OpenTelemetry**
   ```typescript
   // Полная интеграция с OTEL
   // Экспорт в Jaeger, Zipkin, etc.
   import { trace } from "@opentelemetry/api";
   const tracer = trace.getTracer("my-app");
   ```

5. **OpenAPI Generation**
   ```typescript
   import { generateOpenAPI } from "tsdev/generators";
   
   // Автоматическая генерация OpenAPI spec
   const spec = generateOpenAPI(registry);
   ```

## 📊 Архитектура После Интеграции

```
┌─────────────────────────────────────────────────────────┐
│            Next.js App (Browser)                        │
│  ┌─────────────────────────────────────────────┐        │
│  │         page.tsx (Client Component)         │        │
│  └──────────────────┬──────────────────────────┘        │
└────────────────────│────────────────────────────────────┘
                     │ HTTP POST (SSE)
                     ▼
┌─────────────────────────────────────────────────────────┐
│            Next.js Server                               │
│  ┌─────────────────────────────────────────────┐        │
│  │     Hono API (/api/workflows/:id/execute)   │        │
│  └──────────────────┬──────────────────────────┘        │
│                     ▼                                    │
│  ┌─────────────────────────────────────────────┐        │
│  │      tsdev Workflow Runtime                 │        │
│  │  - executeWorkflow(workflow, registry)      │        │
│  └──────────────────┬──────────────────────────┘        │
│                     ▼                                    │
│  ┌─────────────────────────────────────────────┐        │
│  │          tsdev Core                         │        │
│  │  ┌──────────────────────────────────┐       │        │
│  │  │    Registry                      │       │        │
│  │  │  - math.add (Procedure)          │       │        │
│  │  │  - math.multiply (Procedure)     │       │        │
│  │  │  - data.fetch (Procedure)        │       │        │
│  │  └───────────┬──────────────────────┘       │        │
│  │              ▼                               │        │
│  │  ┌──────────────────────────────────┐       │        │
│  │  │  Executor                        │       │        │
│  │  │  - executeProcedure()            │       │        │
│  │  │  - Validation (Zod)              │       │        │
│  │  │  - Apply Policies                │       │        │
│  │  └──────────────────────────────────┘       │        │
│  └─────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

## 🚀 План Миграции

### Фаза 1: Подготовка (1-2 часа)
- [ ] Настроить workspace в корневом package.json
- [ ] Установить зависимости через workspace
- [ ] Убедиться что tsdev builds успешно

### Фаза 2: Создание Procedures (2-3 часа)
- [ ] Создать `procedures.ts` с реальными contract-first procedures
- [ ] Перенести логику из mockProcedures в handlers
- [ ] Добавить Zod schemas для input/output
- [ ] Покрыть тестами

### Фаза 3: Интеграция Runtime (1-2 часа)
- [ ] Создать Registry и зарегистрировать procedures
- [ ] Заменить mock executeWorkflow на реальный из tsdev
- [ ] Обновить импорты
- [ ] Убедиться что types правильные

### Фаза 4: Тестирование (1 час)
- [ ] Проверить что все workflows выполняются
- [ ] Проверить что traces собираются правильно
- [ ] Проверить что SSE streaming работает
- [ ] Проверить что build проходит

### Фаза 5: Улучшения (опционально)
- [ ] Добавить policies (withRetry, withLogging)
- [ ] Настроить реальный OTEL exporter
- [ ] Добавить REST endpoints через tsdev/adapters
- [ ] Генерировать OpenAPI spec

## 📝 Примеры Кода

### До (Mock):

```typescript
// Mock без валидации
const mockProcedures = {
  "math.add": async (input: any) => {
    return { result: input.a + input.b }; // ⚠️ Нет проверки типов
  }
};
```

### После (Real Framework):

```typescript
// Contract-first с валидацией
const mathAdd: Procedure = {
  contract: {
    input: z.object({
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    }),
    output: z.object({
      result: z.number().describe("Sum of a and b"),
    }),
  },
  handler: withLogging(async (input, ctx) => {
    // ✅ input.a и input.b гарантированно numbers
    // ✅ ctx содержит requestId, timestamp, metadata
    return { result: input.a + input.b };
  }),
};

// Регистрация в Registry
registry.register("math.add", mathAdd);
```

## 🎓 Заключение

**Текущий пример** - это отличная starting point для понимания концепций, но это **упрощенная демо версия**.

**Для production использования** рекомендуется:
1. ✅ Интегрировать реальный tsdev framework
2. ✅ Использовать contract-first подход
3. ✅ Применять policies для resilience
4. ✅ Настроить реальный OpenTelemetry
5. ✅ Генерировать OpenAPI documentation

**Время на полную интеграцию**: ~6-8 часов для всех фаз

---

**См. также:**
- [tsdev Core Documentation](../../README.md)
- [Workflow System](../../WORKFLOW_SYSTEM.md)
- [Contract-First Philosophy](../../PHILOSOPHY.md)
