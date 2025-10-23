# 🚀 Quick Start - Cross Integration

Запустите два взаимодействующих c4c приложения за 5 минут!

## Шаг 1: Запуск приложений (2 минуты)

### Терминал 1: App A (Task Manager)

```bash
cd examples/cross-integration/app-a
pnpm install
pnpm dev  # Запускает c4c serve --port 3001
```

**`c4c serve` автоматически:**
- Сканирует `procedures/` и загружает процедуры
- Создает registry
- Запускает HTTP сервер
- Раздает OpenAPI спецификацию

Вы увидите:
```
🚀 c4c server started
   Port: 3001
   OpenAPI: http://localhost:3001/openapi.json
   
📦 Loaded 7 procedure(s):
   - tasks.create
   - tasks.list
   - tasks.get
   - tasks.update
   - tasks.delete
   - tasks.trigger.created
   - tasks.trigger.updated
```

### Терминал 2: App B (Notification Service)

```bash
cd examples/cross-integration/app-b
pnpm install
pnpm dev  # Запускает c4c serve --port 3002
```

Вы увидите:
```
🚀 c4c server started
   Port: 3002
   OpenAPI: http://localhost:3002/openapi.json
   
📦 Loaded 4 procedure(s):
   - notifications.send
   - notifications.list
   - notifications.subscribe
   - notifications.trigger.sent
```

## Шаг 2: Интеграция приложений (1 минута)

### Терминал 3: Запуск интеграции

```bash
cd examples/cross-integration
./scripts/integrate-apps.sh
```

Скрипт выполнит:
1. ✅ Проверит, что оба приложения запущены
2. ✅ Интегрирует App B в App A (`c4c integrate`)
3. ✅ Интегрирует App A в App B (`c4c integrate`)

Результат:
```
🎉 Integration complete!

In App A (Task Manager):
  - notification-service.notifications.send
  - notification-service.notifications.list
  ...

In App B (Notification Service):
  - task-manager.tasks.create
  - task-manager.tasks.list
  ...
```

## Шаг 3: Тестирование (2 минуты)

```bash
cd examples/cross-integration
./scripts/test-integration.sh
```

Скрипт протестирует:
- ✅ Создание задачи в App A
- ✅ App B читает задачи из App A
- ✅ App A отправляет уведомления через App B
- ✅ Обновление задачи в App A
- ✅ App B получает конкретную задачу из App A

## Что произошло?

### До интеграции:

**App A (Task Manager):**
- tasks.create
- tasks.list
- tasks.get
- tasks.update
- tasks.delete

**App B (Notification Service):**
- notifications.send
- notifications.list
- notifications.subscribe

❌ Приложения не могут взаимодействовать

### После интеграции:

**App A (Task Manager):**
- tasks.* (свои процедуры)
- **notification-service.*** ← новые процедуры из App B!

**App B (Notification Service):**
- notifications.* (свои процедуры)
- **task-manager.*** ← новые процедуры из App A!

✅ Приложения могут вызывать процедуры друг друга!

## Примеры использования

### Пример 1: App A отправляет уведомление через App B

```bash
# Создаем задачу в App A
curl -X POST http://localhost:3001/rpc/tasks.create \
  -H "Content-Type: application/json" \
  -d '{"title": "New task"}'

# App A отправляет уведомление через App B
curl -X POST http://localhost:3001/rpc/notification-service.notifications.send \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Task created!",
    "channel": "push"
  }'
```

### Пример 2: App B читает задачи из App A

```bash
# App B получает список задач из App A
curl -X POST http://localhost:3002/rpc/task-manager.tasks.list \
  -H "Content-Type: application/json" \
  -d '{}'

# App B получает конкретную задачу
curl -X POST http://localhost:3002/rpc/task-manager.tasks.get \
  -H "Content-Type: application/json" \
  -d '{"id": "task_123"}'
```

## Структура после интеграции

```
app-a/
├── procedures/tasks.ts
├── generated/              ← Новая папка!
│   └── notification-service/
│       ├── sdk.gen.ts
│       ├── types.gen.ts
│       ├── schemas.gen.ts
│       └── procedures.gen.ts
└── workflows/
    └── notify-on-task-created.ts  ← Использует notification-service!

app-b/
├── procedures/notifications.ts
├── generated/              ← Новая папка!
│   └── task-manager/
│       ├── sdk.gen.ts
│       ├── types.gen.ts
│       ├── schemas.gen.ts
│       └── procedures.gen.ts
└── workflows/
    └── check-overdue-tasks.ts  ← Использует task-manager!
```

## Что дальше?

### 1. Изучите сгенерированные файлы

```bash
# Типы из App B доступны в App A
cat app-a/generated/notification-service/types.gen.ts

# Процедуры App A доступны в App B
cat app-b/generated/task-manager/procedures.gen.ts
```

### 2. Используйте в коде

```typescript
// В app-a/workflows/my-workflow.ts
import type { Notification } from '../generated/notification-service/types.gen.js';

// Полная типизация!
const notification: Notification = await registry.execute(
  'notification-service.notifications.send',
  { message: 'Hello!' }
);
```

### 3. Создайте свои workflows

Смотрите примеры:
- `app-a/workflows/notify-on-task-created.ts`
- `app-b/workflows/check-overdue-tasks.ts`

### 4. Добавьте больше приложений

```bash
# App C может интегрировать оба приложения!
c4c integrate http://localhost:3001/openapi.json
c4c integrate http://localhost:3002/openapi.json

# Теперь App C имеет доступ ко всем процедурам из A и B!
```

## Troubleshooting

### Ошибка: "App A is not running"

```bash
# Проверьте, что App A запущено
curl http://localhost:3001/openapi.json
```

### Ошибка: "procedure not found"

```bash
# Убедитесь, что интеграция выполнена
cd app-a && ls generated/
# Должна быть папка notification-service/
```

### Ошибка: "Cannot find module"

```bash
# Пересоберите проекты
cd app-a && pnpm build
cd app-b && pnpm build
```

## Итог

✅ За 5 минут вы создали экосистему из двух взаимодействующих c4c приложений!

**Ключевые моменты:**
1. Каждое приложение автоматически экспортирует OpenAPI спецификацию
2. `c4c integrate` создает типизированные клиенты
3. Приложения могут вызывать процедуры друг друга как свои собственные
4. Полная поддержка TypeScript типов
5. Webhooks и триггеры работают между приложениями

**Это основа для создания распределенных систем на c4c!** 🎉
