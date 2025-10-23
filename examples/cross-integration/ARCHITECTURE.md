# 🏗️ Архитектура Cross-Integration

## Принципы c4c приложений

### 1. Декларативные процедуры

C4c приложения **не создают свой server.ts**. Вместо этого:

```
app/
├── procedures/           ← Определяете процедуры
│   └── users.ts
├── workflows/            ← Определяете workflows
│   └── user-workflow.ts
└── package.json          ← c4c serve в scripts
```

### 2. Запуск через c4c serve

```bash
c4c serve --port 3000 --root .
```

**c4c serve автоматически:**
1. Сканирует `procedures/` и `workflows/`
2. Загружает все экспортированные процедуры
3. Создает `registry`
4. Запускает HTTP сервер с:
   - RPC endpoints (`/rpc/:name`)
   - REST endpoints (если применимо)
   - WebSocket для workflows
   - OpenAPI спецификация (`/openapi.json`)
   - Swagger UI (`/docs`)

### 3. Будущее: c4c prune

В будущем будет команда для оптимизации production сборки:

```bash
c4c prune --output server.gen.ts
```

**Что делает c4c prune:**
- Анализирует зависимости процедур
- Вычисляет минимальный набор импортов
- Генерирует оптимизированный `server.gen.ts` с явными импортами
- Убирает динамическое сканирование для быстрого холодного старта

**server.gen.ts (пример):**
```typescript
// Автоматически сгенерировано c4c prune
import { createRegistry } from '@c4c/core';
import { createHttpServer } from '@c4c/adapters';

// Явные импорты (вычислены автоматически)
import { createUser } from './procedures/users.js';
import { listUsers } from './procedures/users.js';
import { userCreatedTrigger } from './procedures/webhooks.js';

const registry = createRegistry();
registry.register(createUser);
registry.register(listUsers);
registry.register(userCreatedTrigger);

createHttpServer(registry, process.env.PORT || 3000);
```

**Преимущества c4c prune:**
- ⚡ Быстрый холодный старт (нет динамического сканирования)
- 📦 Меньший bundle (tree-shaking работает)
- 🔒 Предсказуемый набор процедур
- 🚀 Оптимально для production

## Архитектура примера cross-integration

### App A (Task Manager)

```
app-a/
├── procedures/
│   └── tasks.ts                    # Определяет процедуры
│       - tasks.create
│       - tasks.list
│       - tasks.get
│       - tasks.update
│       - tasks.delete
│       - tasks.trigger.created     ← webhook trigger
│       - tasks.trigger.updated     ← webhook trigger
│
├── workflows/
│   └── notify-on-task-created.ts   # Workflow
│       - Триггер: tasks.trigger.created
│       - Шаг: notification-service.send ← из App B!
│
├── generated/                      # После интеграции App B
│   └── notification-service/
│       ├── sdk.gen.ts
│       ├── types.gen.ts
│       ├── schemas.gen.ts
│       ├── triggers.gen.ts
│       └── procedures.gen.ts
│
└── package.json
    "scripts": {
      "dev": "c4c serve --port 3001 --root ."
    }
```

**Запуск:**
```bash
cd app-a
pnpm dev  # → c4c serve --port 3001
```

**c4c serve:**
1. Сканирует `procedures/tasks.ts`
2. Находит 7 процедур
3. Регистрирует их в registry
4. Запускает сервер на :3001
5. Раздает `/openapi.json` с 7 процедурами (5 actions + 2 triggers)

### App B (Notification Service)

```
app-b/
├── procedures/
│   └── notifications.ts            # Определяет процедуры
│       - notifications.send
│       - notifications.list
│       - notifications.subscribe
│       - notifications.trigger.sent ← webhook trigger
│
├── workflows/
│   └── check-overdue-tasks.ts      # Workflow
│       - Триггер: schedule (cron)
│       - Шаг: task-manager.tasks.list ← из App A!
│       - Шаг: notifications.send
│
├── generated/                      # После интеграции App A
│   └── task-manager/
│       ├── sdk.gen.ts
│       ├── types.gen.ts
│       ├── schemas.gen.ts
│       ├── triggers.gen.ts
│       └── procedures.gen.ts
│
└── package.json
    "scripts": {
      "dev": "c4c serve --port 3002 --root ."
    }
```

**Запуск:**
```bash
cd app-b
pnpm dev  # → c4c serve --port 3002
```

**c4c serve:**
1. Сканирует `procedures/notifications.ts`
2. Находит 4 процедуры
3. Регистрирует их в registry
4. Запускает сервер на :3002
5. Раздает `/openapi.json` с 4 процедурами (3 actions + 1 trigger)

## Процесс интеграции

```
┌─────────────────────────────────────┐
│ App A запущено                      │
│ c4c serve --port 3001               │
│                                     │
│ GET /openapi.json                   │
│ {                                   │
│   "paths": {...},                   │
│   "webhooks": {                     │
│     "tasks.trigger.created": {...}  │
│   }                                 │
│ }                                   │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ App B интегрирует App A             │
│ c4c integrate http://localhost:3001/openapi.json
│                                     │
│ 1. Загружает OpenAPI spec           │
│ 2. Генерирует SDK                   │
│ 3. Генерирует процедуры             │
│ 4. Сохраняет в generated/task-manager/
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ App B запущено                      │
│ c4c serve --port 3002               │
│                                     │
│ Registry содержит:                  │
│ - notifications.* (свои)            │
│ - task-manager.* (из App A!)        │
│                                     │
│ Workflows могут использовать:       │
│ - task-manager.tasks.list           │
│ - task-manager.tasks.get            │
│ - task-manager.tasks.trigger.created│
└─────────────────────────────────────┘
```

## Сравнение подходов

### ❌ НЕ ПРАВИЛЬНО (создание своего server.ts)

```typescript
// src/server.ts - ❌ НЕ НАДО!
import { createRegistry } from '@c4c/core';
import { createHttpServer } from '@c4c/adapters';
import { TaskProcedures } from '../procedures/tasks.js';

const registry = createRegistry();
for (const proc of TaskProcedures) {
  registry.register(proc);
}

createHttpServer(registry, 3001);
```

**Проблемы:**
- ❌ Ручное управление импортами
- ❌ Нужно обновлять при добавлении процедур
- ❌ Дублирование логики сканирования
- ❌ Нет автоматической оптимизации

### ✅ ПРАВИЛЬНО (использование c4c serve)

```json
// package.json
{
  "scripts": {
    "dev": "c4c serve --port 3001 --root .",
    "start": "c4c serve --port 3001 --root ."
  }
}
```

```bash
pnpm dev
```

**Преимущества:**
- ✅ Автоматическое сканирование
- ✅ Не нужно управлять импортами
- ✅ Добавил процедуру → она автоматически доступна
- ✅ Единообразный подход во всех приложениях
- ✅ В будущем: `c4c prune` для production оптимизации

## Итого

**Правила c4c приложений:**

1. ✅ **Определяйте процедуры** декларативно в `procedures/`
2. ✅ **Запускайте через** `c4c serve`
3. ✅ **Интегрируйте** через `c4c integrate`
4. ✅ **НЕ создавайте** свой `server.ts` (пока)
5. 🔜 **В будущем:** `c4c prune` для production

**c4c serve** - это convention over configuration!
