# Unified Event System - Final Design

## Концепция

**Trigger Procedures** - единый механизм для внутренних и внешних событий. Workflows идентичны при переходе монолит → микросервисы!

## API

### 1. Создать Trigger Procedure

```typescript
import { createTriggerProcedure } from '@c4c/workflow';
import { z } from 'zod';

const userCreatedTrigger = createTriggerProcedure(
  'user.trigger.created',
  z.object({
    userId: z.string(),
    email: z.string(),
  }),
  {
    description: 'Triggered when user is created',
    provider: 'users',
    exposure: 'internal', // or 'external' for microservices
  }
);

registry.register(userCreatedTrigger);
```

### 2. Создать Workflow

**Вариант А: Builder API**

```typescript
import { workflow, step } from '@c4c/workflow';

const userWorkflow = workflow('user-onboarding')
  .name('User Onboarding')
  .trigger({
    provider: 'users',
    triggerProcedure: 'user.trigger.created',
  })
  .step(step({
    id: 'send-email',
    procedure: 'email.send',
    input: z.object({ email: z.string() }),
    output: z.object({ sent: z.boolean() }),
  }))
  .step(step({
    id: 'track',
    procedure: 'analytics.track',
    input: z.object({ userId: z.string() }),
    output: z.object({ tracked: z.boolean() }),
  }))
  .commit();
```

**Вариант Б: Declarative API** (существующий)

```typescript
import type { WorkflowDefinition } from '@c4c/workflow';

const userWorkflow: WorkflowDefinition = {
  id: 'user-onboarding',
  name: 'User Onboarding',
  version: '1.0.0',
  
  // Trigger configuration
  trigger: {
    provider: 'users',
    triggerProcedure: 'user.trigger.created',
  },
  
  // Workflow nodes
  nodes: [
    {
      id: 'send-email',
      type: 'procedure',
      procedureName: 'email.send',
      next: 'track',
    },
    {
      id: 'track',
      type: 'procedure',
      procedureName: 'analytics.track',
    },
  ],
  startNode: 'send-email',
};
```

### 3. Зарегистрировать Workflow

```typescript
import { registerTriggerHandler } from '@c4c/workflow';

registerTriggerHandler(
  'user.trigger.created',
  userWorkflow,
  registry
);
```

### 4. Использование

#### Монолит (Internal)

```typescript
import { emitTriggerEvent } from '@c4c/workflow';

// В коде приложения
async function createUser(userData) {
  const user = await db.users.create(userData);
  
  // Эмитить событие
  await emitTriggerEvent('user.trigger.created', {
    userId: user.id,
    email: user.email,
  }, registry);
  
  return user;
}
```

#### Микросервисы (External)

```typescript
// 1. Изменить exposure на 'external'
const userCreatedTrigger = createTriggerProcedure(
  'user.trigger.created',
  UserSchema,
  { exposure: 'external' } // ← Только это!
);

// 2. Workflow НЕ МЕНЯЕТСЯ!

// 3. Webhook автоматически вызывает trigger procedure
// POST /webhooks/users → user.trigger.created → workflows
```

## Преимущества

### ✅ Нет метода `.on()`

Используется существующий механизм `trigger: { ... }` в WorkflowDefinition:
- Меньше API surface
- Совместимость с существующим кодом
- Декларативный подход

### ✅ Builder API опционален

```typescript
// Builder API
workflow('id').trigger({ ... }).step(...).commit()

// Или декларативный
const wf: WorkflowDefinition = { trigger: { ... }, nodes: [...] }
```

### ✅ Портируемость

Workflow определяется один раз, работает везде:
- Монолит
- Микросервисы  
- Serverless
- Edge

### ✅ Простая миграция

Монолит → Микросервисы:
```typescript
// Изменить только:
{ exposure: 'internal' } → { exposure: 'external' }

// Workflow остается идентичным!
```

## Архитектура

```
┌─────────────────────────────────────┐
│      TRIGGER PROCEDURE              │
│   (единая точка входа)              │
└──────────────┬──────────────────────┘
               │
      ┌────────┴────────┐
      │                 │
  МОНОЛИТ          МИКРОСЕРВИСЫ
      │                 │
emitTriggerEvent()  POST /webhook
      │                 │
      └────────┬────────┘
               │
      ┌────────▼────────┐
      │   WORKFLOWS     │
      │  (идентичны!)   │
      └─────────────────┘
```

## Полный Пример

```typescript
// 1. Trigger Procedure
const orderPlacedTrigger = createTriggerProcedure(
  'order.trigger.placed',
  z.object({
    orderId: z.string(),
    userId: z.string(),
    amount: z.number(),
  }),
  {
    provider: 'orders',
    exposure: 'internal',
  }
);
registry.register(orderPlacedTrigger);

// 2. Workflow
const orderWorkflow = workflow('order-processing')
  .trigger({
    provider: 'orders',
    triggerProcedure: 'order.trigger.placed',
  })
  .step(step({
    id: 'charge',
    procedure: 'payment.charge',
    input: z.object({ amount: z.number() }),
    output: z.object({ success: z.boolean() }),
  }))
  .step(step({
    id: 'confirm',
    procedure: 'email.send',
    input: z.object({ userId: z.string() }),
    output: z.object({ sent: z.boolean() }),
  }))
  .commit();

// 3. Register
registerTriggerHandler('order.trigger.placed', orderWorkflow, registry);

// 4. Use (Monolith)
await emitTriggerEvent('order.trigger.placed', {
  orderId: 'order_123',
  userId: 'user_456',
  amount: 99.99,
}, registry);

// 5. Migrate to Microservices
// Change only: { exposure: 'external' }
// POST /webhooks/orders → order.trigger.placed → workflow
```

## Итог

✅ Используем существующий `trigger: { ... }` механизм  
✅ Нет нового метода `.on()`  
✅ Builder API опционален (`.trigger()` helper)  
✅ Декларативный подход доступен  
✅ Портируемые workflows  
✅ Простая миграция монолит → микросервисы  

**Главное**: Workflow остается идентичным при рефакторинге! 🎉
