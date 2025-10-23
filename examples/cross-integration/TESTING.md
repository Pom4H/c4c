# 🧪 Тестирование Cross-Integration

## Проверка перед запуском

### 1. Проверка структуры файлов

```bash
cd examples/cross-integration

# Проверьте что структура правильная
tree -L 3 -I 'node_modules|dist'
```

**Ожидаемая структура:**
```
.
├── app-a/
│   ├── package.json
│   ├── procedures/
│   │   └── tasks.ts         # 7 процедур (5 actions + 2 triggers)
│   ├── workflows/
│   │   └── notify-on-task-created.ts
│   └── tsconfig.json
├── app-b/
│   ├── package.json
│   ├── procedures/
│   │   └── notifications.ts # 4 процедуры (3 actions + 1 trigger)
│   ├── workflows/
│   │   └── check-overdue-tasks.ts
│   └── tsconfig.json
└── scripts/
    ├── integrate-apps.sh
    └── test-integration.sh
```

### 2. Установка зависимостей

```bash
# Из корня монорепо
cd /workspace
pnpm install

# Это создаст симлинки:
# examples/cross-integration/app-a/node_modules/@c4c/* -> ../../packages/*
# examples/cross-integration/app-b/node_modules/@c4c/* -> ../../packages/*
```

### 3. Сборка пакетов

```bash
cd /workspace
pnpm build
```

## Запуск приложений

### Terminal 1: App A (Task Manager)

```bash
cd /workspace/examples/cross-integration/app-a

# Запуск через c4c serve
pnpm dev
# или
c4c serve --port 3001 --root .
```

**Ожидаемый вывод:**
```
🚀 c4c server started
   Port: 3001
   Mode: all
   Root: /workspace/examples/cross-integration/app-a

📦 Scanning for procedures...
   Found: procedures/tasks.ts

📋 Loaded procedures:
   - tasks.create (external, api-endpoint)
   - tasks.list (external, api-endpoint)
   - tasks.get (external, api-endpoint)
   - tasks.update (external, api-endpoint)
   - tasks.delete (external, api-endpoint)
   - tasks.trigger.created (external, trigger) ← webhook
   - tasks.trigger.updated (external, trigger) ← webhook

🌐 Server endpoints:
   RPC:     http://localhost:3001/rpc/:name
   OpenAPI: http://localhost:3001/openapi.json
   Docs:    http://localhost:3001/docs
   Webhooks: http://localhost:3001/webhooks/:provider
```

### Terminal 2: App B (Notification Service)

```bash
cd /workspace/examples/cross-integration/app-b

# Запуск через c4c serve
pnpm dev
# или
c4c serve --port 3002 --root .
```

**Ожидаемый вывод:**
```
🚀 c4c server started
   Port: 3002

📦 Scanning for procedures...
   Found: procedures/notifications.ts

📋 Loaded procedures:
   - notifications.send (external, api-endpoint)
   - notifications.list (external, api-endpoint)
   - notifications.subscribe (external, api-endpoint)
   - notifications.trigger.sent (external, trigger) ← webhook

🌐 Server endpoints:
   RPC:     http://localhost:3002/rpc/:name
   OpenAPI: http://localhost:3002/openapi.json
   Docs:    http://localhost:3002/docs
```

## Проверка что серверы работают

### Terminal 3: Проверка OpenAPI

```bash
# Проверьте что оба сервера раздают OpenAPI
curl http://localhost:3001/openapi.json | jq '.info'
curl http://localhost:3002/openapi.json | jq '.info'

# Проверьте что webhooks есть в спецификации
curl http://localhost:3001/openapi.json | jq '.webhooks'
curl http://localhost:3002/openapi.json | jq '.webhooks'
```

**Ожидаемый результат:**
```json
// App A
{
  "webhooks": {
    "tasks.trigger.created": { ... },
    "tasks.trigger.updated": { ... }
  }
}

// App B
{
  "webhooks": {
    "notifications.trigger.sent": { ... }
  }
}
```

### Проверка процедур через RPC

```bash
# App A: создание задачи
curl -X POST http://localhost:3001/rpc/tasks.create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Task",
    "description": "Testing cross-integration",
    "status": "todo",
    "priority": "high"
  }' | jq

# App B: отправка уведомления
curl -X POST http://localhost:3002/rpc/notifications.send \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test notification",
    "channel": "push",
    "priority": "normal"
  }' | jq
```

## Полный тест (всё в одном)

### Самый простой способ - один скрипт делает всё!

```bash
cd /workspace/examples/cross-integration

# Запускает серверы → интегрирует → тестирует → останавливает
./scripts/full-test.sh
```

**Этот скрипт:**
1. ✅ Запускает App A и App B в фоне
2. ✅ Ждёт пока они поднимутся
3. ✅ Выполняет интеграцию
4. ✅ Запускает тесты
5. ✅ Останавливает серверы в конце

**Если вывод заканчивается на:**
```
╔════════════════════════════════════════════════════════════════╗
║                    ✅ ALL TESTS PASSED! ✅                       ║
╚════════════════════════════════════════════════════════════════╝
```
**→ Всё работает! 🎉**

## Интеграция приложений (если серверы уже запущены)

### Вариант 1: Автоматический скрипт

```bash
cd /workspace/examples/cross-integration
./scripts/integrate-apps.sh
```

**Требует:** Серверы должны быть запущены!

### Вариант 2: Вручную

```bash
# Интегрируем App B в App A
cd /workspace/examples/cross-integration/app-a
c4c integrate http://localhost:3002/openapi.json --name notification-service

# Проверяем что файлы сгенерированы
ls -la generated/notification-service/

# Интегрируем App A в App B
cd /workspace/examples/cross-integration/app-b
c4c integrate http://localhost:3001/openapi.json --name task-manager

# Проверяем что файлы сгенерированы
ls -la generated/task-manager/
```

**Ожидаемая структура после интеграции:**
```
app-a/
└── generated/
    └── notification-service/
        ├── sdk.gen.ts
        ├── types.gen.ts
        ├── schemas.gen.ts
        ├── triggers.gen.ts
        └── procedures.gen.ts

app-b/
└── generated/
    └── task-manager/
        ├── sdk.gen.ts
        ├── types.gen.ts
        ├── schemas.gen.ts
        ├── triggers.gen.ts
        └── procedures.gen.ts
```

## Тестирование интеграции

### Тест 1: App A вызывает App B

```bash
# App A отправляет уведомление через App B
curl -X POST http://localhost:3001/rpc/notification-service.notifications.send \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello from App A!",
    "channel": "push"
  }' | jq
```

**Ожидаемый результат:**
```json
{
  "id": "notif_...",
  "message": "Hello from App A!",
  "channel": "push",
  "priority": "normal",
  "status": "sent",
  "sentAt": "2025-10-23T...",
  "createdAt": "2025-10-23T..."
}
```

### Тест 2: App B вызывает App A

```bash
# App B получает список задач из App A
curl -X POST http://localhost:3002/rpc/task-manager.tasks.list \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

**Ожидаемый результат:**
```json
{
  "tasks": [
    {
      "id": "task_...",
      "title": "Test Task",
      "status": "todo",
      "priority": "high",
      ...
    }
  ],
  "total": 1
}
```

### Тест 3: Полный сценарий

```bash
cd /workspace/examples/cross-integration
./scripts/test-integration.sh
```

## Возможные проблемы

### Проблема 1: "Cannot find package '@c4c/core'"

**Решение:**
```bash
cd /workspace
pnpm install
```

### Проблема 2: "Command 'c4c' not found"

**Решение:**
```bash
cd /workspace
pnpm build
# или используйте через pnpm exec
pnpm exec c4c serve --port 3001
```

### Проблема 3: "Connection refused" при интеграции

**Причина:** Серверы не запущены

**Решение:**
```bash
# Убедитесь что оба сервера запущены:
curl http://localhost:3001/openapi.json
curl http://localhost:3002/openapi.json
```

### Проблема 4: "No procedures found"

**Причина:** c4c serve не может найти процедуры

**Решение:**
```bash
# Убедитесь что процедуры правильно экспортированы
grep "export const.*Procedure" app-a/procedures/tasks.ts
grep "export const.*Procedure" app-b/procedures/notifications.ts

# Убедитесь что вы запускаете из правильной директории
c4c serve --port 3001 --root /absolute/path/to/app-a
```

### Проблема 5: Port already in use

**Решение:**
```bash
# Найдите процесс на порту
lsof -i :3001
lsof -i :3002

# Убейте процесс
kill -9 <PID>

# Или используйте другие порты
c4c serve --port 3003 --root .
```

## Итоговая проверка

После успешного запуска и интеграции у вас должно быть:

✅ App A запущено на :3001
✅ App B запущено на :3002
✅ `curl http://localhost:3001/openapi.json` возвращает OpenAPI с webhooks
✅ `curl http://localhost:3002/openapi.json` возвращает OpenAPI с webhooks
✅ `app-a/generated/notification-service/` существует
✅ `app-b/generated/task-manager/` существует
✅ App A может вызывать `notification-service.notifications.send`
✅ App B может вызывать `task-manager.tasks.list`
✅ `./scripts/test-integration.sh` проходит успешно

**Если все чекбоксы ✅ - интеграция работает!** 🎉
