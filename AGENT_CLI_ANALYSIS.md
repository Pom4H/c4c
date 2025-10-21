# Анализ CLI для агентов: текущее состояние и рекомендации

## Резюме проблем

AI-агенты, работающие с c4c CLI, испытывают следующие трудности:

1. **Не понимают, запущен ли dev-сервер** - нет простого способа проверить статус
2. **Не знают порт** - информация есть в session.json, но агенты не знают о `.c4c/dev/`
3. **Часто перезапускают сервер** - из-за отсутствия понимания текущего состояния
4. **Затрудняются с логами** - нет структурированного вывода, нужно парсить текст

## Текущая реализация

### Что уже есть

#### 1. Флаг `--agent`
```bash
c4c dev --agent
```

**Что делает:**
- Устанавливает `userType: "agent"` в метаданных сессии
- Меняет сообщение: `pnpm "c4c dev stop"` вместо `Press Ctrl+C`
- Больше ничего специфичного для агентов

#### 2. Метаданные сессии (`.c4c/dev/session.json`)
```json
{
  "id": "uuid",
  "pid": 12345,
  "port": 3000,
  "mode": "all",
  "projectRoot": "/workspace",
  "handlersPath": "/workspace/src/handlers",
  "userType": "agent",
  "logFile": "/workspace/.c4c/dev/dev.log",
  "startedAt": "2025-10-21T...",
  "status": "running"
}
```

**Проблемы:**
- Агенты не знают про `.c4c/dev/session.json`
- Нет команды для чтения этого файла
- Формат не документирован для агентов

#### 3. Команды управления

```bash
c4c dev                # Запуск
c4c dev stop          # Остановка
c4c dev logs          # Логи
```

**Проблемы:**
- Нет команды `c4c dev status`
- `dev logs` возвращает текст, не JSON
- Нет информации о порте/режиме

#### 4. RPC процедуры

```typescript
dev.control.stop      // Остановка через RPC
dev.control.logs      // Логи через RPC
```

**Проблемы:**
- Требуют знания порта (замкнутый круг)
- Нет процедуры `dev.control.status`

## Рекомендации по улучшению DX для агентов

### 1. Команда `c4c dev status` (КРИТИЧНО)

**Проблема:** Агенты не знают, запущен ли сервер и на каком порту.

**Решение:** Добавить команду с machine-readable выводом.

```bash
# Использование
c4c dev status

# Вывод (JSON) - когда запущен
{
  "running": true,
  "pid": 12345,
  "port": 3000,
  "mode": "all",
  "userType": "agent",
  "startedAt": "2025-10-21T10:30:00Z",
  "uptime": "5m 23s",
  "projectRoot": "/workspace",
  "handlersPath": "/workspace/src/handlers",
  "health": "ok",
  "endpoints": {
    "rpc": "http://localhost:3000/rpc",
    "procedures": "http://localhost:3000/procedures",
    "workflow": "http://localhost:3000/workflow",
    "health": "http://localhost:3000/health"
  }
}

# Вывод - когда не запущен
{
  "running": false,
  "message": "No dev server found"
}
```

**Флаг `--json`:**
```bash
c4c dev status --json    # Machine-readable (default для --agent)
c4c dev status           # Human-readable (default для human)
```

**Примеры использования агентом:**
```bash
# Проверка перед действием
STATUS=$(c4c dev status --json)
if [ "$(echo $STATUS | jq -r '.running')" = "true" ]; then
  PORT=$(echo $STATUS | jq -r '.port')
  curl http://localhost:$PORT/procedures
else
  c4c dev --agent
fi
```

### 2. Улучшенный `c4c dev logs` (ВЫСОКИЙ ПРИОРИТЕТ)

**Проблема:** Логи в виде текста сложно парсить.

**Решение:** Добавить флаг `--json` для структурированных логов.

```bash
# Текущая реализация
c4c dev logs
# Output: plain text

# Новая реализация
c4c dev logs --json --tail 10
```

**Вывод (JSON):**
```json
{
  "running": true,
  "logFile": "/workspace/.c4c/dev/dev.log",
  "lines": [
    {
      "timestamp": "2025-10-21T10:30:00Z",
      "level": "info",
      "message": "[c4c] HTTP server listening on http://localhost:3000",
      "raw": "[c4c] HTTP server listening on http://localhost:3000"
    },
    {
      "timestamp": "2025-10-21T10:30:01Z",
      "level": "info",
      "message": "[Registry] + data.get [external]",
      "raw": "[Registry] + data.get [external] @handlers/data.ts",
      "event": "procedure_registered",
      "procedure": "data.get",
      "metadata": {
        "exposure": "external",
        "path": "handlers/data.ts"
      }
    },
    {
      "timestamp": "2025-10-21T10:30:05Z",
      "level": "error",
      "message": "[c4c] Error in procedure users.create",
      "raw": "[c4c] Error in procedure users.create: Validation error",
      "event": "procedure_error",
      "procedure": "users.create",
      "error": "Validation error"
    }
  ],
  "summary": {
    "total": 10,
    "errors": 1,
    "warnings": 0,
    "procedures": {
      "registered": 5,
      "updated": 0,
      "removed": 0
    }
  }
}
```

**Фильтрация:**
```bash
c4c dev logs --json --level error                    # Только ошибки
c4c dev logs --json --event procedure_error          # Только ошибки процедур
c4c dev logs --json --since "5m"                     # За последние 5 минут
```

### 3. Флаг `--agent` должен менять defaults (СРЕДНИЙ ПРИОРИТЕТ)

**Проблема:** Агенты получают human-readable вывод по умолчанию.

**Решение:** Когда используется `--agent`, все команды должны возвращать JSON.

```bash
# Запуск с флагом --agent
c4c dev --agent

# Все последующие команды автоматически используют --json
c4c dev status      # → JSON (потому что сессия помечена как agent)
c4c dev logs        # → JSON
```

**Реализация:**
```typescript
// commands/dev.ts
const userType: DevUserType = options.agent ? "agent" : "human";

// Сохраняем в session.json
const metadata: DevSessionMetadata = {
  // ...
  userType,
};

// В commands/status.ts, logs.ts
const session = await discoverActiveSession(projectRoot);
const isAgentMode = session?.metadata.userType === "agent";
const outputFormat = options.json || isAgentMode ? "json" : "text";
```

### 4. RPC процедура `dev.control.status` (СРЕДНИЙ ПРИОРИТЕТ)

**Проблема:** Нет способа получить статус через HTTP API.

**Решение:** Добавить процедуру для программного доступа.

```typescript
// apps/cli/src/internal/contracts/dev-control.ts
export const devControlStatusContract = {
  name: "dev.control.status",
  description: "Returns dev server status and configuration",
  input: z.object({}),
  output: z.object({
    running: z.literal(true),
    pid: z.number(),
    port: z.number(),
    mode: z.enum(["all", "rest", "workflow", "rpc"]),
    userType: z.enum(["agent", "human"]),
    startedAt: z.string(),
    uptime: z.number(),
    projectRoot: z.string(),
    handlersPath: z.string(),
    health: z.enum(["ok", "degraded"]),
    endpoints: z.object({
      rpc: z.string(),
      procedures: z.string(),
      workflow: z.string(),
      health: z.string(),
    }),
  }),
  metadata: {
    exposure: "external",
    roles: ["sdk-client", "api-endpoint"],
    category: "devtools",
    tags: ["cli", "status"],
  },
} as unknown as Contract;
```

**Использование:**
```bash
# Через CLI (если порт известен)
curl http://localhost:3000/rpc/dev.control.status -X POST

# Или через generated client
const client = createc4cClient({ baseUrl: "http://localhost:3000" });
const status = await client.procedures["dev.control.status"]({});
```

### 5. Переменные окружения (НИЗКИЙ ПРИОРИТЕТ)

**Проблема:** Агенты не знают, где искать метаданные сессии.

**Решение:** После запуска `c4c dev` записывать переменные в `.env.c4c`.

```bash
# c4c dev автоматически создает .env.c4c
C4C_DEV_RUNNING=true
C4C_DEV_PORT=3000
C4C_DEV_PID=12345
C4C_DEV_MODE=all
C4C_DEV_SESSION_FILE=/workspace/.c4c/dev/session.json
```

**Использование агентом:**
```bash
# Агент может source этот файл
source .env.c4c
if [ "$C4C_DEV_RUNNING" = "true" ]; then
  curl http://localhost:$C4C_DEV_PORT/procedures
fi
```

### 6. Улучшенная обработка ошибок (СРЕДНИЙ ПРИОРИТЕТ)

**Проблема:** Ошибки в текстовом формате, сложно парсить.

**Решение:** Структурированные коды ошибок.

```bash
# Текущее поведение
c4c dev
# Error: A c4c dev server already appears to be running (pid 12345)...
# Exit code: 1

# Новое поведение (с --agent или --json)
c4c dev --agent
```

**JSON вывод:**
```json
{
  "success": false,
  "error": {
    "code": "DEV_SERVER_ALREADY_RUNNING",
    "message": "A c4c dev server is already running",
    "details": {
      "pid": 12345,
      "port": 3000,
      "startedAt": "2025-10-21T10:30:00Z"
    },
    "suggestions": [
      "Run 'c4c dev stop' to stop the existing server",
      "Run 'c4c dev status' to check the server status"
    ]
  }
}
```

**Коды ошибок:**
```typescript
enum DevErrorCode {
  DEV_SERVER_ALREADY_RUNNING = "DEV_SERVER_ALREADY_RUNNING",
  DEV_SERVER_NOT_FOUND = "DEV_SERVER_NOT_FOUND",
  DEV_SERVER_STARTING = "DEV_SERVER_STARTING",
  PORT_IN_USE = "PORT_IN_USE",
  HANDLERS_NOT_FOUND = "HANDLERS_NOT_FOUND",
  INVALID_MODE = "INVALID_MODE",
}
```

### 7. Идемпотентные команды (ВЫСОКИЙ ПРИОРИТЕТ)

**Проблема:** Агенты часто перезапускают сервер из-за неопределенности.

**Решение:** Сделать `c4c dev` идемпотентным с флагом `--ensure`.

```bash
# Новая команда
c4c dev --ensure

# Поведение:
# - Если сервер не запущен → запустить
# - Если сервер запущен → проверить health и вернуть статус
# - Если сервер в состоянии "stopping" → подождать и перезапустить
```

**Вывод (JSON для агентов):**
```json
{
  "action": "already_running",
  "message": "Dev server is already running",
  "status": {
    "running": true,
    "pid": 12345,
    "port": 3000,
    "uptime": "5m 23s"
  }
}

// ИЛИ

{
  "action": "started",
  "message": "Dev server started",
  "status": {
    "running": true,
    "pid": 67890,
    "port": 3000,
    "uptime": "0s"
  }
}
```

### 8. Уведомления о изменениях (НИЗКИЙ ПРИОРИТЕТ)

**Проблема:** Агенты не знают, когда процедуры перезагружаются.

**Решение:** SSE endpoint для событий dev-сервера.

```bash
# GET /dev/events (Server-Sent Events)
curl http://localhost:3000/dev/events
```

**События:**
```
event: procedure_registered
data: {"name":"users.create","path":"handlers/users.ts"}

event: procedure_updated
data: {"name":"users.update","path":"handlers/users.ts"}

event: procedure_removed
data: {"name":"users.delete","path":"handlers/users.ts"}

event: health_check
data: {"status":"ok","timestamp":"2025-10-21T10:30:00Z"}
```

## Сравнение: до и после

### Сценарий 1: Проверка статуса сервера

**До:**
```bash
# Агент не знает, как проверить
# Попытка 1: запуск
c4c dev
# Error: server already running

# Попытка 2: curl health
curl http://localhost:3000/health
# curl: (7) Failed to connect - не знаем порт

# Попытка 3: чтение session.json
cat .c4c/dev/session.json
# cat: .c4c/dev/session.json: No such file or directory
# Агент не знает про этот файл

# Результат: агент в замешательстве, делает c4c dev stop && c4c dev
```

**После:**
```bash
# Агент проверяет статус
c4c dev status --json

# Получает ответ:
{
  "running": true,
  "port": 3000,
  "endpoints": {
    "procedures": "http://localhost:3000/procedures"
  }
}

# Агент использует информацию
curl http://localhost:3000/procedures
```

### Сценарий 2: Чтение логов

**До:**
```bash
c4c dev logs
# Вывод:
# [c4c] HTTP server listening on http://localhost:3000
# [Registry] + data.get [external] @handlers/data.ts
# [c4c] Error in procedure users.create: Validation error

# Агент пытается парсить regex
# Сложно извлечь структурированные данные
```

**После:**
```bash
c4c dev logs --json --level error
```

```json
{
  "lines": [
    {
      "level": "error",
      "procedure": "users.create",
      "error": "Validation error",
      "timestamp": "2025-10-21T10:30:05Z"
    }
  ],
  "summary": {
    "errors": 1
  }
}
```

```bash
# Агент легко обрабатывает JSON
jq '.lines[] | select(.level=="error")' logs.json
```

### Сценарий 3: Гарантированный запуск

**До:**
```bash
# Агент хочет убедиться, что сервер запущен
# Единственный способ:
c4c dev stop
c4c dev

# Проблемы:
# - Убивает существующий сервер (даже если был нужен)
# - Медленно (перезапуск)
# - Теряются активные соединения
```

**После:**
```bash
# Агент использует --ensure
c4c dev --ensure --agent

# Вывод:
{
  "action": "already_running",
  "status": { "running": true, "port": 3000 }
}

# Сервер не перезапускается, агент получает информацию
```

## Приоритизация реализации

### MVP (Must Have) - Week 1
1. ✅ **`c4c dev status --json`** - критично для агентов
2. ✅ **`c4c dev logs --json`** - упрощает парсинг
3. ✅ **`c4c dev --ensure`** - предотвращает ненужные перезапуски

### Phase 2 - Week 2
4. ✅ **Флаг `--agent` меняет defaults** - лучший UX
5. ✅ **Структурированные ошибки** - упрощает обработку
6. ✅ **RPC `dev.control.status`** - программный доступ

### Phase 3 - Future
7. ⏳ **`.env.c4c`** - удобство для скриптов
8. ⏳ **SSE `/dev/events`** - реальное время обновлений

## Примеры использования агентами

### TypeScript SDK для агентов

```typescript
// @c4c/agent-sdk
import { C4CDevClient } from "@c4c/agent-sdk";

const dev = new C4CDevClient({
  projectRoot: process.cwd(),
});

// Проверка статуса
const status = await dev.status();
if (!status.running) {
  await dev.start({ mode: "all", agent: true });
}

// Получение порта
const port = status.port;
const procedures = await fetch(`http://localhost:${port}/procedures`);

// Чтение логов
const logs = await dev.logs({ level: "error", tail: 10 });
for (const log of logs.lines) {
  if (log.event === "procedure_error") {
    console.error(`Error in ${log.procedure}: ${log.error}`);
  }
}

// Остановка
await dev.stop();
```

### Bash скрипт для агента

```bash
#!/bin/bash
# agent-workflow.sh

# Проверка статуса
STATUS=$(c4c dev status --json 2>/dev/null)

if [ $? -ne 0 ] || [ "$(echo $STATUS | jq -r '.running')" != "true" ]; then
  echo "Starting dev server..."
  c4c dev --agent --mode all &
  sleep 3
  STATUS=$(c4c dev status --json)
fi

# Извлечение порта
PORT=$(echo $STATUS | jq -r '.port')
echo "Dev server running on port $PORT"

# Получение процедур
curl -s http://localhost:$PORT/procedures | jq '.procedures[] | .name'

# Проверка логов на ошибки
ERRORS=$(c4c dev logs --json --level error | jq '.summary.errors')
if [ "$ERRORS" -gt 0 ]; then
  echo "Found $ERRORS errors in logs"
  c4c dev logs --json --level error | jq -r '.lines[] | "\(.procedure): \(.error)"'
fi
```

### Python агент

```python
# agent.py
import subprocess
import json

class C4CDevClient:
    def status(self):
        result = subprocess.run(
            ["c4c", "dev", "status", "--json"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            return {"running": False}
        return json.loads(result.stdout)
    
    def ensure_running(self):
        status = self.status()
        if not status.get("running"):
            subprocess.run(["c4c", "dev", "--agent"], check=True)
            return self.status()
        return status
    
    def logs(self, level=None, tail=None):
        cmd = ["c4c", "dev", "logs", "--json"]
        if level:
            cmd.extend(["--level", level])
        if tail:
            cmd.extend(["--tail", str(tail)])
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        return json.loads(result.stdout)

# Использование
client = C4CDevClient()
status = client.ensure_running()
print(f"Server running on port {status['port']}")

# Проверка ошибок
logs = client.logs(level="error", tail=10)
if logs["summary"]["errors"] > 0:
    for line in logs["lines"]:
        print(f"Error: {line['message']}")
```

## Заключение

### Текущие проблемы агентов
1. ❌ Нет простого способа узнать статус сервера
2. ❌ Нет информации о порте без чтения внутренних файлов
3. ❌ Частые перезапуски из-за неопределенности
4. ❌ Сложный парсинг текстовых логов

### После реализации рекомендаций
1. ✅ `c4c dev status --json` - моментальная информация
2. ✅ Порт и endpoints в JSON ответе
3. ✅ `c4c dev --ensure` - идемпотентный запуск
4. ✅ `c4c dev logs --json` - структурированные логи

### Выгоды для агентов
- **Скорость:** не нужно перезапускать сервер без причины
- **Надежность:** структурированные данные вместо парсинга текста
- **Простота:** одна команда вместо множества проб и ошибок
- **Автоматизация:** легко интегрировать в скрипты и SDK

### Выгоды для людей
- Все новые команды полезны и для людей (с `--json` опционально)
- Лучшая observability dev-сервера
- Меньше "магии" - понятно что происходит
