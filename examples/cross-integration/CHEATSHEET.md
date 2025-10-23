# 📋 C4C Cross-Integration Cheat Sheet

## Быстрые команды

### Создание процедуры для экспорта

```typescript
import { defineContract, defineProcedure } from '@c4c/core';
import { z } from 'zod';

export const myProcedure = defineProcedure({
  contract: {
    name: 'resource.action',           // users.create, tasks.update
    description: 'What it does',
    input: z.object({ /* ... */ }),
    output: z.object({ /* ... */ }),
    metadata: {
      exposure: 'external',            // ← Обязательно для экспорта!
      roles: ['api-endpoint', 'workflow-node', 'sdk-client'],
    },
  },
  handler: async (input) => { /* ... */ },
});
```

### Создание триггера

```typescript
export const myTrigger = defineProcedure({
  contract: {
    name: 'resource.trigger.event',    // users.trigger.created
    input: z.object({ webhookUrl: z.string().url() }),
    output: z.object({ /* event payload */ }),
    metadata: {
      exposure: 'external',
      type: 'trigger',                 // ← Обязательно!
      roles: ['trigger', 'workflow-node'],
      trigger: {
        type: 'webhook',               // webhook | watch | poll | stream
        eventTypes: ['resource.event'], // users.created
      },
      provider: 'my-app',              // ← Уникальный ID приложения
    },
  },
  handler: async (input) => { /* ... */ },
});
```

### Запуск сервера

```typescript
import { createRegistry } from '@c4c/core';
import { createHttpServer } from '@c4c/adapters';

const registry = createRegistry();
registry.register(myProcedure);
registry.register(myTrigger);

createHttpServer(registry, 3000);
// OpenAPI автоматически на http://localhost:3000/openapi.json
```

### Экспорт OpenAPI спецификации

```bash
# Базовый экспорт
c4c export-spec

# С опциями
c4c export-spec \
  --output ./api.json \
  --title "My API" \
  --version "1.0.0" \
  --server-url "https://api.myapp.com"
```

### Интеграция другого приложения

```bash
# Из работающего сервера
c4c integrate http://localhost:3001/openapi.json --name other-app

# Из файла
c4c integrate ./path/to/openapi.json --name other-app
```

### Использование интегрированных процедур

#### В workflow

```typescript
export const myWorkflow: WorkflowDefinition = {
  steps: [
    {
      id: 'call-other-app',
      procedure: 'other-app.resource.action', // ← Интегрированная процедура!
      input: { /* ... */ },
    },
  ],
};
```

#### В процедуре

```typescript
handler: async (input, context) => {
  // Вызов интегрированной процедуры
  const result = await context.registry.execute(
    'other-app.resource.action',
    { /* ... */ }
  );
  return result;
}
```

#### С типами

```typescript
import type { User } from './generated/other-app/types.gen.js';

const user: User = await registry.execute('other-app.users.get', { id: '123' });
```

## Структура после интеграции

```
my-app/
├── procedures/
│   └── my-procedures.ts
├── generated/                    ← Создается автоматически
│   └── other-app/
│       ├── sdk.gen.ts           ← API клиент
│       ├── types.gen.ts         ← TypeScript типы
│       ├── schemas.gen.ts       ← Zod схемы
│       ├── triggers.gen.ts      ← Метаданные триггеров
│       └── procedures.gen.ts    ← C4C процедуры
└── workflows/
    └── my-workflow.ts           ← Использует other-app процедуры
```

## Проверка интеграции

```bash
# 1. Проверьте что оба приложения работают
curl http://localhost:3001/openapi.json
curl http://localhost:3002/openapi.json

# 2. Интегрируйте
c4c integrate http://localhost:3001/openapi.json --name app-a

# 3. Проверьте сгенерированные файлы
ls generated/app-a/

# 4. Проверьте доступность процедур
curl http://localhost:3002/rpc/app-a.resource.action \
  -H "Content-Type: application/json" \
  -d '{ /* input */ }'
```

## Типичные паттерны

### Паттерн 1: Цепочка вызовов

```typescript
steps: [
  { procedure: 'app-a.users.get' },
  { procedure: 'app-b.notifications.send', input: { userId: '{{ steps.0.output.id }}' } },
  { procedure: 'app-c.analytics.track', input: { event: 'notification_sent' } },
]
```

### Паттерн 2: Агрегация данных

```typescript
handler: async (input, context) => {
  const [users, orders, notifications] = await Promise.all([
    context.registry.execute('user-service.users.list'),
    context.registry.execute('order-service.orders.list'),
    context.registry.execute('notification-service.list'),
  ]);
  return { users, orders, notifications };
}
```

### Паттерн 3: Event-driven

```typescript
// App A: триггер события
export const orderCreatedTrigger = defineProcedure({
  metadata: { type: 'trigger', trigger: { eventTypes: ['order.created'] } },
  // ...
});

// App B: слушает событие
export const handleOrderCreated: WorkflowDefinition = {
  trigger: {
    type: 'webhook',
    config: { procedure: 'shop-service.orders.trigger.created' },
  },
  steps: [
    { procedure: 'notifications.send' },
    { procedure: 'analytics.track' },
  ],
};
```

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| Процедура не экспортируется | Добавьте `exposure: 'external'` в metadata |
| 404 на `/openapi.json` | Убедитесь что сервер запущен с `createHttpServer` |
| Интеграция не создала файлы | Проверьте URL спецификации, должна быть валидная OpenAPI 3.x |
| TypeScript ошибки | Запустите `pnpm build` после интеграции |
| "procedure not found" | Проверьте что процедура зарегистрирована в registry |

## Полезные ссылки

- **Полный пример**: `examples/cross-integration/`
- **Документация**: `CROSS_INTEGRATION_COMPLETE.md`
- **Руководство**: `ECOSYSTEM_GUIDE.md`

## Quick Reference

```bash
# Экспорт спецификации
c4c export-spec --output api.json

# Интеграция
c4c integrate <url> --name <name>

# Запуск примера
cd examples/cross-integration
./scripts/integrate-apps.sh
./scripts/test-integration.sh
```

---

**Pro tip**: Добавьте в CI/CD автоматическую публикацию OpenAPI спецификации после каждого деплоя!
