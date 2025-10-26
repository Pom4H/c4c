# Unified Event System - Implementation Summary

## Проблема

При рефакторинге из монолита в микросервисы приходится переписывать workflows и event handlers, потому что внутренние события работают иначе чем внешние webhooks.

## Решение

**Trigger procedures** - единый механизм для внутренних и внешних событий. Workflows остаются идентичными при переходе монолит → микросервисы!

## Архитектура

### Монолит (Internal Events)

```
Application Code
    ↓
emitTriggerEvent('user.trigger.created', data)
    ↓
Trigger Procedure (user.trigger.created)
    ↓
Registered Workflows
    ↓
executeWorkflow()
```

### Микросервисы (External Events)

```
External Service
    ↓
POST /webhooks/users
    ↓
Webhook Handler
    ↓
Trigger Procedure (user.trigger.created)
    ↓
Registered Workflows
    ↓
executeWorkflow()
```

**Ключевое отличие**: способ вызова trigger procedure (внутри vs webhook), но **workflow остается идентичным**!

## Реализация

### 1. Trigger Procedures (`trigger-procedure.ts`)

Новый файл с механизмом trigger procedures:

**Ключевые функции:**
- `createTriggerProcedure()` - создать trigger procedure с схемой
- `emitTriggerEvent()` - вызвать trigger procedure (для монолита)
- `registerTriggerHandler()` - зарегистрировать workflow на trigger
- `executeTriggerHandlers()` - выполнить все workflows для trigger

**Как работает:**
1. Trigger procedure - это обычная процедура с метаданными trigger
2. При вызове trigger procedure (внутренне или через webhook) вызываются все зарегистрированные workflows
3. Workflows регистрируются через `registerTriggerHandler()`

### 2. Обновленный `workflow.on()`

Теперь ссылается на trigger procedure:

```typescript
workflow('order-processing')
  .on('order.trigger.placed', step({ ... }))
  .commit();
```

**Что изменилось:**
- Убраны synthetic trigger nodes
- Убраны options { internal, provider, eventType }
- Теперь просто ссылка на имя trigger procedure
- Trigger procedure содержит всю конфигурацию

### 3. Унифицированный TriggerWorkflowManager

**Что изменилось:**
- Убран WorkflowEventEmitter для внутренних событий
- Убран `registerInternalEventHandlers()`
- Добавлен `registerTriggerHandler()` для всех типов событий
- Один механизм для внутренних и внешних

### 4. Упрощенный Export API

```typescript
// Основной API
export {
  createTriggerProcedure,    // Создать trigger
  emitTriggerEvent,          // Эмитить событие (монолит)
  registerTriggerHandler,    // Зарегистрировать workflow
};

// WorkflowEventEmitter помечен deprecated
```

## Использование

### Шаг 1: Определить Trigger Procedure

```typescript
import { createTriggerProcedure } from '@c4c/workflow';

const userCreatedTrigger = createTriggerProcedure(
  'user.trigger.created',
  z.object({
    userId: z.string(),
    email: z.string(),
  }),
  {
    description: 'Triggered when user is created',
    provider: 'users',
    exposure: 'internal', // или 'external' для микросервисов
  }
);

// Зарегистрировать
registry.register(userCreatedTrigger);
```

### Шаг 2: Создать Workflow

```typescript
import { workflow, step } from '@c4c/workflow';

const userWorkflow = workflow('user-onboarding')
  .on('user.trigger.created', step({
    id: 'send-email',
    procedure: 'email.send',
    input: z.object({ email: z.string() }),
    output: z.object({ sent: z.boolean() }),
  }))
  .step(step({ id: 'track', procedure: 'analytics.track' }))
  .commit();
```

### Шаг 3: Зарегистрировать Workflow

```typescript
import { registerTriggerHandler } from '@c4c/workflow';

registerTriggerHandler(
  'user.trigger.created',
  userWorkflow,
  registry
);
```

### Шаг 4А: Монолит - Эмитить События

```typescript
import { emitTriggerEvent } from '@c4c/workflow';

// В коде приложения
await createUser(userData);
await emitTriggerEvent('user.trigger.created', userData, registry);
// → Trigger procedure вызывается
// → Все зарегистрированные workflows выполняются
```

### Шаг 4Б: Микросервисы - Webhook

```typescript
// Изменить только exposure в trigger
const userCreatedTrigger = createTriggerProcedure(
  'user.trigger.created',
  schema,
  { exposure: 'external' } // ← Только это!
);

// Workflow остается идентичным!
// POST /webhooks/users → user.trigger.created → workflows
```

## Преимущества

### 1. Портируемость

✅ Workflow определен один раз, работает везде:
- Монолит
- Микросервисы
- Serverless
- Edge workers

### 2. Упрощенная Миграция

```typescript
// Монолит → Микросервисы

// ❌ Старый подход: переписать все
eventBus.on('user.created', ...) 
→ app.post('/webhook', ...)

// ✅ Новый подход: изменить одну строку
{ exposure: 'internal' } 
→ { exposure: 'external' }
```

### 3. Типобезопасность

```typescript
// Zod валидация на trigger procedure
const trigger = createTriggerProcedure(
  'user.created',
  z.object({ email: z.string().email() })
);

// ✅ Valid
await emitTriggerEvent('user.created', {
  email: 'john@example.com'
}, registry);

// ❌ Invalid - Zod error
await emitTriggerEvent('user.created', {
  email: 'invalid'
}, registry);
```

### 4. Множественные Workflows

```typescript
// Несколько workflows на один trigger
registerTriggerHandler('user.created', emailWorkflow, registry);
registerTriggerHandler('user.created', analyticsWorkflow, registry);
registerTriggerHandler('user.created', notificationWorkflow, registry);

// Все выполнятся при вызове trigger
await emitTriggerEvent('user.created', data, registry);
```

### 5. Автоматический Трacing

```typescript
// OpenTelemetry трейсинг автоматически:
trigger.procedure
  └── workflow.execute
      ├── step.send-email
      └── step.track-signup
```

## Изменённые Файлы

### Core
- ✅ `packages/workflow/src/trigger-procedure.ts` - новый файл
- ✅ `packages/workflow/src/builder.ts` - упрощен `on()`
- ✅ `packages/workflow/src/trigger-manager.ts` - унифицирован
- ✅ `packages/workflow/src/index.ts` - обновлены экспорты
- ✅ `packages/workflow/src/event-emitter.ts` - помечен deprecated

### Examples
- ✅ `examples/basic/unified-events-demo.ts` - полный пример
- ✅ `examples/basic/procedures/triggers.ts` - примеры trigger procedures

### Documentation
- ✅ `docs/guide/unified-events.md` - новая документация
- ✅ `docs/guide/workflows.md` - обновлена ссылка
- 🗑️ Удалены старые документы:
  - `docs/guide/workflow-events.md`
  - `docs/examples/workflow-events.md`
  - `examples/basic/events-demo.ts`
  - `examples/basic/workflows/events-example.ts`

## Breaking Changes

### ❌ Deprecated (но работает)

```typescript
// Старый API все еще работает, но deprecated
import { emitWorkflowEvent, WorkflowEventEmitter } from '@c4c/workflow';
```

### ✅ New API

```typescript
// Новый API
import { 
  createTriggerProcedure, 
  emitTriggerEvent,
  registerTriggerHandler,
} from '@c4c/workflow';
```

### Migration Guide

**Было:**
```typescript
// Старый подход с workflow.on() и options
const wf = workflow('handler')
  .on('user.created', step({ ... }), { 
    internal: true,
    provider: 'users'
  })
  .commit();

await emitWorkflowEvent('user.created', data);
```

**Стало:**
```typescript
// 1. Создать trigger procedure
const trigger = createTriggerProcedure(
  'user.trigger.created',
  UserSchema,
  { provider: 'users', exposure: 'internal' }
);
registry.register(trigger);

// 2. Workflow без options
const wf = workflow('handler')
  .on('user.trigger.created', step({ ... }))
  .commit();

// 3. Эмитить через trigger procedure
await emitTriggerEvent('user.trigger.created', data, registry);
```

## Тестирование

```bash
cd examples/basic
pnpm install
pnpm tsx unified-events-demo.ts
```

Ожидаемый вывод:
- ✅ Регистрация workflows
- ✅ Эмиссия событий
- ✅ Выполнение workflows
- ✅ Логи трейсинга

## Итог

✅ **Унифицированный механизм** - внутренние и внешние события работают одинаково  
✅ **Портируемые workflows** - не меняются при рефакторинге  
✅ **Простая миграция** - изменить exposure в trigger procedure  
✅ **Типобезопасность** - Zod валидация  
✅ **Автоматический трacing** - OpenTelemetry  
✅ **Множественные обработчики** - несколько workflows на один trigger  

**Главное преимущество**: При переходе монолит → микросервисы **workflow остается идентичным**, меняется только способ вызова trigger procedure!
