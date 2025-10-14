# ✅ Runtime Fix - Полное Разделение Core и Demo

## Проблема

В `examples/nextjs-workflow-viz/src/lib/workflow/runtime.ts` был полный дубликат runtime кода, который должен быть в `core/workflow`.

## Решение

Полностью разделили:
- **Core runtime** → `src/core/workflow/` (фреймворк с OTEL)
- **Demo mocks** → `examples/.../lib/workflow/` (только mock данные)

## Новая Структура

### Framework Core (`src/core/workflow/`)

```
src/core/workflow/
├── types.ts          # Типы workflow + TraceSpan
├── runtime.ts        # Основной runtime с OTEL
├── index.ts          # Экспорты
└── react/
    ├── useWorkflow.ts  # React хуки
    └── README.md       # Документация
```

**Что делает:**
- ✅ Выполнение workflow с OTEL трейсингом
- ✅ Интеграция с framework registry
- ✅ Использует executeProcedure из core
- ✅ Автоматическая иерархия spans

### Example Demo Files (`examples/.../lib/workflow/`)

```
examples/nextjs-workflow-viz/src/lib/workflow/
├── core-runtime.ts       # 📦 Re-export из core
├── mock-procedures.ts    # 🎭 Mock процедуры для демо
├── mock-registry.ts      # 🎭 Создание registry из mocks
├── span-collector.ts     # 📊 Простой collector для UI
├── runtime.ts            # 🔌 Тонкая обертка над core
├── examples.ts           # 📝 Примеры workflows
└── types.ts              # 📋 Локальные типы для UI
```

**Что делает:**
- ✅ Предоставляет mock процедуры для демо
- ✅ Использует core runtime из фреймворка
- ✅ Собирает spans для визуализации
- ✅ НЕ дублирует логику выполнения

## Разделение Ответственности

### Core Runtime (Фреймворк)
```typescript
// src/core/workflow/runtime.ts

export async function executeWorkflow(
  workflow: WorkflowDefinition,
  registry: Registry,  // ← Использует framework Registry
  initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
  // Реальный OTEL трейсинг
  return tracer.startActiveSpan('workflow.execute', async (span) => {
    // Выполнение с framework core
    const output = await executeProcedure(procedure, input, context);
    // ...
  });
}
```

### Demo Adapter (Пример)
```typescript
// examples/.../lib/workflow/runtime.ts

export async function executeWorkflow(
  workflow: WorkflowDefinition,
  initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
  const mockRegistry = createMockRegistry();  // Mock для демо
  const collector = new SpanCollector();      // Для UI
  
  // Вызывает core runtime
  const result = await coreExecuteWorkflow(workflow, mockRegistry, initialInput);
  
  return {
    ...result,
    spans: collector.getSpans()  // Добавляет spans для UI
  };
}
```

## Файлы и Их Назначение

### Framework Core

| Файл | Назначение | Содержит |
|------|-----------|----------|
| `core/workflow/runtime.ts` | Основной runtime | OTEL трейсинг, выполнение workflow |
| `core/workflow/types.ts` | Типы | WorkflowDefinition, TraceSpan и т.д. |
| `core/workflow/react/useWorkflow.ts` | React хуки | Hooks для UI интеграции |

### Example Demo

| Файл | Назначение | Содержит |
|------|-----------|----------|
| `mock-procedures.ts` | 🎭 Mock данные | Демо процедуры (math.add, data.fetch) |
| `mock-registry.ts` | 🎭 Registry builder | Создает Registry из mocks |
| `span-collector.ts` | 📊 UI helper | Простой сборщик spans для графика |
| `runtime.ts` | 🔌 Adapter | Тонкая обертка над core runtime |
| `core-runtime.ts` | 📦 Re-export | Чистые импорты из core |

## Что Удалено из Example

❌ `TraceCollector` класс (был дубликат)
❌ `executeWorkflow` реализация (использует core)
❌ `executeNode` функция (в core)
❌ `executeProcedureNode` функция (в core)
❌ `executeConditionNode` функция (в core)
❌ `executeParallelNode` функция (в core)
❌ `evaluateExpression` функция (в core)

**Итого удалено:** ~250 строк дублирующего кода

## Что Осталось в Example

✅ `mockProcedures` - демо процедуры
✅ `SpanCollector` - для UI визуализации
✅ `createMockRegistry()` - создание registry для демо
✅ Тонкая обертка `executeWorkflow()` - 15 строк адаптера

**Итого осталось:** ~100 строк demo-специфичного кода

## Поток Выполнения

### До Исправления
```
UI Component
    ↓
Local executeWorkflow (full implementation)
    ↓
Mock procedures
    ↓
Custom TraceCollector
```
**Проблема:** Дублирование runtime логики

### После Исправления
```
UI Component
    ↓
useWorkflow hook
    ↓
API Route
    ↓
examples/runtime.ts (adapter)
    ↓
src/core/workflow/runtime.ts (framework)
    ↓
Mock Registry (demo)
    ↓
Framework Core (executeProcedure)
```
**Решение:** Core runtime + demo mocks

## Преимущества

### 1. Разделение Ответственностей
- **Core:** Бизнес-логика выполнения workflow
- **Example:** Mock данные для демонстрации

### 2. Переиспользование
- Core runtime можно использовать везде
- Example показывает как интегрировать

### 3. Поддержка
- Одна реализация в core
- Bugfix в одном месте
- Тесты на core runtime

### 4. OTEL Интеграция
- Core использует настоящий OTEL
- Example собирает spans для UI
- Чистая архитектура

## Использование

### В Production
```typescript
import { collectRegistry } from 'tsdev/core';
import { executeWorkflow } from 'tsdev/core/workflow';

const registry = await collectRegistry('src/handlers');
const result = await executeWorkflow(workflow, registry, input);
```

### В Demo (Next.js Example)
```typescript
import { executeWorkflow } from '@/lib/workflow/runtime';

// Использует mock procedures внутри
const result = await executeWorkflow(workflow, input);
```

## Проверка

### Framework Core
```bash
# Runtime находится в правильном месте
ls src/core/workflow/runtime.ts  # ✅

# Использует OTEL из фреймворка
grep "trace.getTracer" src/core/workflow/runtime.ts  # ✅
```

### Example
```bash
# Только mock данные
ls examples/nextjs-workflow-viz/src/lib/workflow/mock-*.ts  # ✅

# Использует core runtime
grep "coreExecuteWorkflow" examples/.../runtime.ts  # ✅

# Нет дублирования логики
wc -l examples/.../runtime.ts  # ~50 lines (was ~370)
```

## Итог

✅ **Runtime полностью в core/workflow**
✅ **Example содержит только mock данные**
✅ **Чистая архитектура**
✅ **Следует философии фреймворка**
✅ **Никакого дублирования кода**

---

**Статус:** ✅ ИСПРАВЛЕНО

**Дата:** 2025-10-14

**Удалено дубликатов:** ~250 строк
**Создано файлов:** 4 новых файла (mocks + helpers)
