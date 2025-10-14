# Current Status: Standalone Demo vs Framework Integration

## 🎯 Текущий Статус

### ❌ Пример НЕ использует tsdev фреймворк

Пример `nextjs-workflow-viz` это **standalone демо** с упрощенной реализацией, которая **не подключена** к основному tsdev фреймворку.

## 📂 Структура Проекта

```
/workspace/
├── src/                           # ← Основной tsdev framework
│   ├── core/
│   │   ├── executor.ts           # Реальный executor с валидацией
│   │   ├── registry.ts           # Registry для procedures
│   │   └── types.ts              # Core types
│   ├── workflow/
│   │   ├── runtime.ts            # Реальный workflow runtime
│   │   └── types.ts              # Workflow types
│   └── policies/                  # withRetry, withRateLimit, etc.
│
└── examples/
    └── nextjs-workflow-viz/       # ← Standalone демо
        └── src/
            └── lib/
                └── workflow/
                    ├── runtime.ts     # ⚠️ Mock implementation
                    ├── hono-app.ts    # Hono SSE endpoints
                    └── sse-client.ts  # SSE client

❌ Нет импортов между ними!
```

## 🔍 Ключевые Отличия

### Mock Implementation (examples/nextjs-workflow-viz)

| Аспект | Реализация | Статус |
|--------|-----------|--------|
| **Registry** | ❌ Нет | Hardcoded `mockProcedures` object |
| **Contracts** | ❌ Нет | Нет Zod schemas для валидации |
| **Валидация** | ❌ Нет | Input/output не проверяются |
| **Policies** | ❌ Нет | Нет retry, rate-limit, logging |
| **OpenTelemetry** | ⚠️ Mock | Простой in-memory TraceCollector |
| **Procedures** | ⚠️ Hardcoded | 6 mock functions в runtime.ts |
| **Transport** | ✅ Hono SSE | REST + SSE через Hono |

### Real tsdev Framework (src/)

| Аспект | Реализация | Статус |
|--------|-----------|--------|
| **Registry** | ✅ Да | Полноценный Registry с типами |
| **Contracts** | ✅ Да | Zod schemas для input/output |
| **Валидация** | ✅ Да | Автоматическая валидация через Zod |
| **Policies** | ✅ Да | withRetry, withRateLimit, withLogging |
| **OpenTelemetry** | ✅ Real | `@opentelemetry/api` integration |
| **Procedures** | ✅ Registry | Динамическая регистрация procedures |
| **Transport** | ✅ Agnostic | HTTP, CLI, (будущее: WS, gRPC) |

## 📝 Сравнение Кода

### Mock Procedures (текущая реализация)

```typescript
// examples/nextjs-workflow-viz/src/lib/workflow/runtime.ts

// ❌ Нет contracts, нет валидации
const mockProcedures: Record<
  string,
  (input: Record<string, unknown>) => Promise<Record<string, unknown>>
> = {
  "math.add": async (input: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const a = input.a as number; // ⚠️ Unsafe cast
    const b = input.b as number; // ⚠️ Unsafe cast
    return { result: a + b };
  },
  "math.multiply": async (input: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const a = input.a as number;
    const b = (input.b as number | undefined) ?? 1;
    return { result: a * b };
  },
  // ... еще 4 mock procedures
};

// ❌ Mock executor без Registry
export async function executeWorkflow(
  workflow: WorkflowDefinition,
  initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
  // Прямой вызов mockProcedures[procedureName]
  const procedure = mockProcedures[node.procedureName];
  const output = await procedure(input); // ⚠️ Нет валидации
  // ...
}
```

### Real Framework (доступно, но не используется)

```typescript
// src/workflow/runtime.ts

import { executeProcedure, createExecutionContext } from "../core/executor.js";
import type { Registry } from "../core/types.js";

// ✅ Реальный executor с Registry
export async function executeWorkflow(
  workflow: WorkflowDefinition,
  registry: Registry, // ← Требует Registry!
  initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
  // ...
  
  // ✅ Получение процедуры из Registry
  const procedure = registry.get(node.procedureName);
  if (!procedure) {
    throw new Error(`Procedure ${node.procedureName} not found in registry`);
  }
  
  // ✅ Выполнение с валидацией через contracts
  const output = await executeProcedure(procedure, input, context);
  
  // ...
}
```

### Real Procedure с Contract

```typescript
// src/handlers/math.ts (пример из основного проекта)

import { z } from "zod";
import type { Procedure } from "../core/types.js";

// ✅ Contract-first procedure
export const addProcedure: Procedure = {
  contract: {
    input: z.object({
      a: z.number().describe("First operand"),
      b: z.number().describe("Second operand"),
    }),
    output: z.object({
      result: z.number().describe("Sum of a and b"),
    }),
  },
  handler: async (input, ctx) => {
    // ✅ input уже провалидирован, точные типы
    // input.a: number
    // input.b: number
    return { result: input.a + input.b };
  },
};
```

## 🔄 Текущая Архитектура

```
┌─────────────────────────────────────────┐
│   Next.js App (Browser)                 │
│   - page.tsx                            │
│   - SSE Client                          │
└───────────────┬─────────────────────────┘
                │ HTTP/SSE
                ▼
┌─────────────────────────────────────────┐
│   Next.js API Route                     │
│   - /api/[[...route]]/route.ts          │
│   - Hono adapter                        │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│   Hono App                              │
│   - hono-app.ts                         │
│   - POST /api/workflows/:id/execute     │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│   Mock Workflow Runtime                 │  ⚠️ Упрощенная версия
│   - executeWorkflow()                   │
│   - TraceCollector (mock)               │
│   - mockProcedures (hardcoded)          │
└─────────────────────────────────────────┘

❌ Не использует src/core/
❌ Не использует src/workflow/
❌ Не использует Registry
```

## 🎯 Почему Сделано Так?

### Преимущества Standalone Demo:

1. ✅ **Простота установки**: `npm install && npm run dev`
2. ✅ **Нет зависимостей**: Работает без настройки tsdev
3. ✅ **Легко понять**: Весь код в одном месте
4. ✅ **Быстрый старт**: Демо концепций workflow visualization
5. ✅ **Независимость**: Можно копировать в другой проект

### Недостатки:

1. ❌ **Дублирование кода**: Своя реализация runtime
2. ❌ **Нет валидации**: Нет contract-first подхода
3. ❌ **Нет policies**: Нет retry, rate-limit, etc.
4. ❌ **Mock OpenTelemetry**: Не настоящий OTEL
5. ❌ **Hardcoded procedures**: Нельзя добавить новые легко

## 🚀 Что Дальше?

### Опция 1: Оставить как есть (Standalone Demo)
- Хорошо для демонстрации концепций
- Легко показать кому-то
- Не для production использования

### Опция 2: Интегрировать tsdev Framework
- См. [FRAMEWORK_INTEGRATION.md](./FRAMEWORK_INTEGRATION.md)
- Получить все преимущества framework
- ~6-8 часов работы для полной интеграции

## 📊 Сравнительная Таблица

| Функция | Standalone Demo | С tsdev Framework |
|---------|----------------|-------------------|
| Установка | ⭐⭐⭐⭐⭐ Очень просто | ⭐⭐⭐ Нужен setup |
| Валидация | ❌ Нет | ✅ Zod schemas |
| Типизация | ⚠️ Частичная | ✅ Полная |
| Policies | ❌ Нет | ✅ Да (retry, rate-limit) |
| OpenTelemetry | ⚠️ Mock | ✅ Реальный |
| Расширяемость | ⚠️ Сложно | ✅ Легко через Registry |
| Production Ready | ❌ Нет | ✅ Да |
| Обслуживание | ⚠️ Дублирование | ✅ Один источник правды |

## 📚 Документация

- **[FRAMEWORK_INTEGRATION.md](./FRAMEWORK_INTEGRATION.md)** - Как интегрировать tsdev
- **[HONO_SSE_INTEGRATION.md](./HONO_SSE_INTEGRATION.md)** - Текущая SSE реализация
- **[MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)** - Миграция с Server Actions

## 💡 Рекомендация

Для **production** использования:
1. 📖 Прочитать [FRAMEWORK_INTEGRATION.md](./FRAMEWORK_INTEGRATION.md)
2. 🔧 Настроить workspace
3. ✍️ Создать реальные procedures с contracts
4. 🔌 Подключить tsdev/workflow/runtime
5. 🧪 Протестировать интеграцию

Для **демо/прототипа**:
- ✅ Текущая реализация работает отлично!
- ✅ Показывает концепции workflow visualization
- ✅ SSE streaming работает
- ✅ OpenTelemetry traces собираются

---

**Статус**: ✅ Работает как standalone demo  
**Интеграция с tsdev**: ❌ Не подключена  
**Для production**: ⚠️ Требуется интеграция с framework
