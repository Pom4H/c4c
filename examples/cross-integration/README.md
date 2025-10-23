# 🔄 Cross-Integration Example

Демонстрация двустороннего взаимодействия между двумя c4c приложениями через OpenAPI спецификации.

## Архитектура

```
┌─────────────────────────────────────────┐
│         App A: Task Manager             │
│                                         │
│  Procedures:                            │
│  - tasks.create                         │
│  - tasks.list                           │
│  - tasks.update                         │
│                                         │
│  Triggers:                              │
│  - task.created (webhook)               │
│  - task.updated (webhook)               │
│                                         │
│  Port: 3001                             │
│  OpenAPI: http://localhost:3001/openapi.json
└─────────────────────────────────────────┘
                    ↕
            c4c integrate
                    ↕
┌─────────────────────────────────────────┐
│    App B: Notification Service          │
│                                         │
│  Procedures:                            │
│  - notifications.send                   │
│  - notifications.list                   │
│  - notifications.subscribe              │
│                                         │
│  Triggers:                              │
│  - notification.sent (webhook)          │
│                                         │
│  Port: 3002                             │
│  OpenAPI: http://localhost:3002/openapi.json
└─────────────────────────────────────────┘
```

## Использование

### 1. Запуск обоих приложений

```bash
# Terminal 1: App A
cd examples/cross-integration/app-a
pnpm install
pnpm dev  # Запустится на :3001

# Terminal 2: App B
cd examples/cross-integration/app-b
pnpm install
pnpm dev  # Запустится на :3002
```

### 2. Интеграция App A → App B

```bash
cd examples/cross-integration/app-b

# Интегрируем App A в App B
c4c integrate http://localhost:3001/openapi.json --name task-manager

# Теперь App B может вызывать процедуры App A!
```

### 3. Интеграция App B → App A

```bash
cd examples/cross-integration/app-a

# Интегрируем App B в App A
c4c integrate http://localhost:3002/openapi.json --name notifications

# Теперь App A может вызывать процедуры App B!
```

### 4. Взаимодействие

После интеграции:

**App A может отправлять уведомления через App B:**
```typescript
// В app-a/workflows/task-workflow.ts
steps: [
  {
    id: 'create-task',
    procedure: 'tasks.create',
    input: { title: 'New task' },
  },
  {
    id: 'notify',
    procedure: 'notifications.send', // ← Процедура из App B!
    input: {
      message: 'New task created: {{ steps.create-task.output.title }}',
    },
  },
]
```

**App B может получать задачи из App A:**
```typescript
// В app-b/workflows/notification-workflow.ts
steps: [
  {
    id: 'get-tasks',
    procedure: 'task-manager.tasks.list', // ← Процедура из App A!
  },
  {
    id: 'send-summary',
    procedure: 'notifications.send',
    input: {
      message: 'You have {{ steps.get-tasks.output.length }} tasks',
    },
  },
]
```

## Сценарии

### Сценарий 1: Автоматические уведомления о задачах

1. Пользователь создает задачу в App A
2. App A триггер `task.created` срабатывает
3. Workflow в App A вызывает `notifications.send` (из App B)
4. App B отправляет уведомление

### Сценарий 2: Проверка задач по расписанию

1. App B запускает периодический workflow
2. Вызывает `task-manager.tasks.list` (из App A)
3. Фильтрует просроченные задачи
4. Отправляет уведомления через `notifications.send`

## OpenAPI спецификации

Оба приложения автоматически экспортируют свои спецификации:

- App A: http://localhost:3001/openapi.json
- App B: http://localhost:3002/openapi.json

Спецификации включают:
- ✅ Все procedure endpoints (REST + RPC)
- ✅ Webhooks для триггеров
- ✅ Метаданные c4c (`x-c4c-triggers`)
- ✅ Полные схемы данных

## Структура проекта

```
cross-integration/
├── app-a/                      # Task Manager
│   ├── package.json            # c4c serve в scripts
│   ├── procedures/
│   │   └── tasks.ts           # CRUD для задач + триггеры
│   ├── workflows/
│   │   └── task-workflow.ts   # Workflow с уведомлениями
│   └── generated/             # После интеграции App B
│       └── notifications/
│           ├── sdk.gen.ts
│           ├── types.gen.ts
│           └── procedures.gen.ts
│
├── app-b/                      # Notification Service
│   ├── package.json            # c4c serve в scripts
│   ├── procedures/
│   │   └── notifications.ts   # Отправка уведомлений + триггеры
│   ├── workflows/
│   │   └── check-tasks.ts     # Проверка задач из App A
│   └── generated/             # После интеграции App A
│       └── task-manager/
│           ├── sdk.gen.ts
│           ├── types.gen.ts
│           └── procedures.gen.ts
│
├── scripts/
│   ├── integrate-apps.sh      # Автоматическая интеграция
│   └── test-integration.sh    # Тестирование
│
└── README.md

ВАЖНО: Нет server.ts файлов!
Приложения запускаются через c4c serve,
который автоматически сканирует и загружает процедуры.
```

## Результат

После полной интеграции:

1. ✅ App A имеет доступ к процедурам App B
2. ✅ App B имеет доступ к процедурам App A
3. ✅ Оба приложения могут подписываться на триггеры друг друга
4. ✅ Workflows могут свободно комбинировать процедуры из обоих приложений
5. ✅ Полная типизация TypeScript для всех вызовов

**Это создает экосистему взаимодействующих микросервисов на c4c!** 🎉

## Важные замечания

### ⚠️ Нет server.ts!

C4c приложения **не создают свой server.ts**. Вместо этого используется:

```bash
c4c serve --port 3001 --root .
```

**c4c serve автоматически:**
- Сканирует `procedures/` и `workflows/`
- Загружает все процедуры
- Создает registry
- Запускает HTTP сервер
- Раздает `/openapi.json`

### 🔜 Будущее: c4c prune

Для production будет команда `c4c prune`, которая:
- Вычисляет зависимости
- Генерирует оптимизированный `server.gen.ts` с явными импортами
- Убирает динамическое сканирование для быстрого холодного старта

См. `ARCHITECTURE.md` для деталей.
