# Workflow Portability: Monolith → Microservices

## Концепция

Этот пример доказывает, что **workflows полностью портируемы** между монолитом и микросервисами. **Нулевые изменения** в workflow коде!

## Архитектура

### Монолит (App A Standalone)

```
┌─────────────────────────────────────┐
│         APP A (Monolith)            │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Task Management            │  │
│  │   - Create task              │  │
│  │   - emitTriggerEvent()       │  │
│  └──────────┬───────────────────┘  │
│             │                       │
│             ▼                       │
│  ┌──────────────────────────────┐  │
│  │   Trigger Procedure          │  │
│  │   tasks.trigger.created      │  │
│  └──────────┬───────────────────┘  │
│             │                       │
│             ▼                       │
│  ┌──────────────────────────────┐  │
│  │   Workflow (SAME!)           │  │
│  │   - Get task (local)         │  │
│  │   - Send notification (stub) │  │
│  └──────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

### Микросервисы (After c4c integrate)

```
┌──────────────────────┐         ┌──────────────────────┐
│   APP A              │         │   APP B              │
│   (Task Service)     │         │   (Notification)     │
│                      │         │                      │
│  Create task         │  POST   │  Webhook Handler     │
│       │              │ ──────> │       │              │
│       ▼              │         │       ▼              │
│  POST webhook        │         │  Trigger Procedure   │
│                      │         │       │              │
└──────────────────────┘         │       ▼              │
                                 │  ┌────────────────┐  │
                                 │  │ Workflow       │  │
                                 │  │ (SAME!)        │  │
                                 │  │                │  │
                                 │  │ - Get task     │  │
                                 │  │   (integrated) │  │
                                 │  │ - Send notif   │  │
                                 │  │   (native)     │  │
                                 │  └────────────────┘  │
                                 │                      │
                                 └──────────────────────┘
```

**Ключевая идея:** Workflow в обоих случаях ИДЕНТИЧНЫЙ!

## Демонстрация

### 1. Монолит Mode

```bash
cd examples/cross-integration/app-a
pnpm tsx monolith-mode.ts
```

**Вывод:**
```
🏗️  MONOLITH MODE - App A Standalone

📦 Registering procedures...
  ✓ tasks.get
  ✓ tasks.create
  ✓ tasks.trigger.created (trigger)
  ✓ notifications.send (local stub)

🔄 Registering workflow...
  ✓ Task Notification Workflow

📝 Creating a new task...
  Task created: Implement feature X (task_123)

🎯 Emitting trigger event (monolith mode)...
  [TriggerProcedure] Trigger 'tasks.trigger.created' invoked
  [Workflow] ✅ Node completed: get-task
  [Workflow] ✅ Node completed: send-notification
  
  📧 [Local Notification Stub]
     Message: 🆕 New task: Implement feature X
     Channel: push

✅ Task created and notification sent!
💡 Notice: Workflow used local procedures only.
```

### 2. Микросервисы Mode

```bash
# Terminal 1: Start app-b (notification service)
cd examples/cross-integration/app-b
pnpm tsx microservices-mode.ts

# Terminal 2: Send webhook from app-a
curl -X POST http://localhost:3001/webhooks/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "task_123",
    "title": "Implement feature X",
    "status": "todo",
    "priority": "high"
  }'
```

**Вывод (app-b):**
```
🌐 MICROSERVICES MODE - App B with Integration

📦 Registering app-b procedures...
  ✓ notifications.send
  ✓ notifications.list

🔗 Registering integrated procedures (from app-a)...
  ✓ tasks.get (integrated)
  ✓ tasks.create (integrated)
  ✓ tasks.trigger.created (integrated)

🔄 Registering workflow (IDENTICAL to monolith!)...
  ✓ Task Notification Workflow
  💡 This is THE SAME workflow code as in monolith!

🚀 Server started on http://localhost:3001

📨 [Webhook] Received event from app-a:
   Event: tasks.created
   Provider: tasks
   
  [TriggerProcedure] Trigger 'tasks.trigger.created' invoked
  [Workflow] ✅ Node completed: get-task (via integration)
  [Workflow] ✅ Node completed: send-notification (native)
  
  🔔 [Notification Service]
     Sending notification: 🆕 New task: Implement feature X
     Channel: push
     Status: sent

✅ Workflow executed via integrated procedures!
💡 Workflow code: IDENTICAL to monolith!
```

## Что Изменилось?

### App A (Task Service)

```typescript
// БЫЛО (monolith):
const trigger = createTriggerProcedure(
  'tasks.trigger.created',
  TaskSchema,
  { exposure: 'internal' } // ← Internal
);

await emitTriggerEvent('tasks.trigger.created', task, registry);

// СТАЛО (microservices):
const trigger = createTriggerProcedure(
  'tasks.trigger.created',
  TaskSchema,
  { exposure: 'external' } // ← External (единственное изменение!)
);

// Emit via webhook instead
await fetch('http://app-b:3001/webhooks/tasks', {
  method: 'POST',
  body: JSON.stringify(task),
});
```

### App B (Notification Service)

```typescript
// ДОБАВЛЕНО:
// 1. Integrated procedures (via c4c integrate)
import * as TaskIntegration from './procedures/integrations/task-manager/...';

// 2. Webhook handler
webhookRegistry.registerHandler('tasks', async (event) => {
  // Will automatically trigger tasks.trigger.created
});

// 3. SAME workflow (no changes!)
registerTriggerHandler(
  'tasks.trigger.created',
  taskNotificationWorkflow, // ← IDENTICAL!
  registry
);
```

### Workflow Code

```typescript
// МОНОЛИТ и МИКРОСЕРВИСЫ - ОДИНАКОВО! ✅
export const taskNotificationWorkflow = workflow('task-notification')
  .trigger({
    provider: 'tasks',
    triggerProcedure: 'tasks.trigger.created',
  })
  .step(step({
    id: 'get-task',
    procedure: 'tasks.get', // Local in monolith, integrated in microservices
  }))
  .step(step({
    id: 'send-notification',
    procedure: 'notifications.send', // Stub in monolith, native in microservices
  }))
  .commit();
```

**НИ ОДНОЙ СТРОЧКИ НЕ ИЗМЕНИЛОСЬ!** 🎉

## Тесты

```bash
cd examples/cross-integration
pnpm test tests/workflow-portability.test.ts
```

Тесты доказывают:

1. ✅ Workflow работает в монолите с локальными procedures
2. ✅ Тот же workflow работает в микросервисах с integrated procedures
3. ✅ Workflow definition идентичен в обоих случаях
4. ✅ Миграция не требует изменений workflow кода

## Миграционный Путь

### Шаг 1: Работаем в монолите

```typescript
// app-a: все процедуры локальные
const registry = createRegistry();
registry.register(tasksGet);
registry.register(tasksCreate);
registry.register(notificationsSend); // local stub

// Workflow с локальными процедурами
registerTriggerHandler('tasks.trigger.created', workflow, registry);

// Эмитим события внутри приложения
await emitTriggerEvent('tasks.trigger.created', task, registry);
```

### Шаг 2: Выделяем notifications в отдельный сервис

```bash
# Интегрируем app-a procedures в app-b
cd app-b
c4c integrate task-manager --url http://app-a:3000
```

Генерируется:
- `app-b/procedures/integrations/task-manager/procedures.gen.ts`
- `app-b/procedures/integrations/task-manager/triggers/...`

### Шаг 3: Переносим workflow (copy-paste!)

```typescript
// app-b: регистрируем интегрированные процедуры
import * as TaskIntegration from './procedures/integrations/task-manager/...';

const registry = createRegistry();
registry.register(notificationsSend); // native
for (const proc of Object.values(TaskIntegration)) {
  registry.register(proc); // integrated
}

// SAME workflow, zero changes!
registerTriggerHandler('tasks.trigger.created', workflow, registry);
```

### Шаг 4: Меняем trigger на external

```typescript
// app-a: меняем только exposure
const trigger = createTriggerProcedure(
  'tasks.trigger.created',
  TaskSchema,
  { exposure: 'external' } // internal → external
);
```

### Шаг 5: Переключаемся на webhooks

```typescript
// app-a: вместо emitTriggerEvent
await fetch('http://app-b:3001/webhooks/tasks', {
  method: 'POST',
  body: JSON.stringify(task),
});
```

**Готово!** Workflow работает в микросервисах **без единого изменения**.

## CLI Команда (Future)

Идея для автоматизации:

```bash
# Export workflow and its dependencies to another service
c4c export workflow task-notification --to notification-service

# This would:
# 1. Analyze workflow dependencies
# 2. Generate integration code
# 3. Copy workflow definition
# 4. Update trigger exposure
# 5. Generate migration instructions
```

## Ключевые Преимущества

### ✅ Портируемость
Workflow определен один раз, работает везде

### ✅ Нулевые изменения
При миграции монолит → микросервисы workflow не меняется

### ✅ Простая интеграция
`c4c integrate` автоматически генерирует integration code

### ✅ Тестируемость
Легко тестировать в обеих архитектурах

### ✅ Постепенная миграция
Можно мигрировать по одному workflow за раз

## Вывод

**Workflows в c4c полностью портируемы!**

- Монолит: `emitTriggerEvent()` + локальные procedures
- Микросервисы: webhook + integrated procedures
- Workflow: **ИДЕНТИЧЕН** в обоих случаях! 🎉

Это делает рефакторинг из монолита в микросервисы **тривиальным** — достаточно:
1. `c4c integrate`
2. Изменить `exposure: 'external'`
3. Переключиться на webhooks

Workflow код **не трогаем вообще**! ✅
