# c4c CLI: Quick Reference для агентов

## Сравнительная таблица: Human vs Agent CLI

| Задача | Human (текущее) | Agent (после улучшений) |
|--------|-----------------|-------------------------|
| **Проверить статус** | `ps aux \| grep c4c` или попытка `c4c dev` | `c4c dev status --json` |
| **Узнать порт** | Читать `.c4c/dev/session.json` (не документировано) | `c4c dev status --json` → `.port` |
| **Запустить сервер** | `c4c dev` (ошибка если уже запущен) | `c4c dev --ensure --agent` (идемпотентно) |
| **Прочитать логи** | `c4c dev logs` (парсить текст) | `c4c dev logs --json` (структурировано) |
| **Найти ошибки** | `c4c dev logs \| grep -i error` | `c4c dev logs --json --level error` |
| **Остановить** | `Ctrl+C` или `c4c dev stop` | `c4c dev stop` |

## Команды

### 1. Проверка статуса

```bash
# Human
c4c dev status

# Agent
c4c dev status --json
```

**Вывод (JSON):**
```json
{
  "running": true,
  "pid": 12345,
  "port": 3000,
  "mode": "all",
  "uptime": "5m 23s",
  "health": "ok",
  "endpoints": {
    "procedures": "http://localhost:3000/procedures",
    "rpc": "http://localhost:3000/rpc"
  }
}
```

### 2. Запуск сервера (идемпотентный)

```bash
# Запустить если не запущен, вернуть статус если запущен
c4c dev --ensure --agent
```

**Вывод (уже запущен):**
```json
{
  "action": "already_running",
  "status": { "running": true, "port": 3000 }
}
```

**Вывод (запущен только что):**
```json
{
  "action": "started",
  "status": { "running": true, "port": 3000 }
}
```

### 3. Чтение логов

```bash
# Все логи в JSON
c4c dev logs --json

# Только ошибки
c4c dev logs --json --level error

# Последние 10 строк
c4c dev logs --json --tail 10

# За последние 5 минут
c4c dev logs --json --since 5m

# Только ошибки процедур
c4c dev logs --json --event procedure_error
```

**Вывод:**
```json
{
  "running": true,
  "lines": [
    {
      "timestamp": "2025-10-21T10:30:00Z",
      "level": "error",
      "procedure": "users.create",
      "error": "Validation error",
      "message": "Error in procedure users.create: Validation error"
    }
  ],
  "summary": {
    "total": 1,
    "errors": 1,
    "warnings": 0
  }
}
```

### 4. Остановка сервера

```bash
c4c dev stop
```

## Типичные сценарии использования

### Сценарий 1: Убедиться что сервер запущен

```bash
#!/bin/bash

# Проверяем статус
STATUS=$(c4c dev status --json 2>/dev/null)

if [ $? -ne 0 ] || [ "$(echo $STATUS | jq -r '.running')" != "true" ]; then
  echo "Server not running, starting..."
  c4c dev --ensure --agent
else
  echo "Server already running"
fi

# Теперь используем сервер
PORT=$(c4c dev status --json | jq -r '.port')
curl http://localhost:$PORT/procedures
```

### Сценарий 2: Проверка на ошибки

```bash
#!/bin/bash

# Получаем ошибки из логов
ERRORS=$(c4c dev logs --json --level error | jq '.summary.errors')

if [ "$ERRORS" -gt 0 ]; then
  echo "Found $ERRORS errors:"
  c4c dev logs --json --level error | jq -r '.lines[] | "\(.procedure): \(.error)"'
  exit 1
fi

echo "No errors found"
```

### Сценарий 3: Мониторинг процедур

```bash
#!/bin/bash

# Смотрим какие процедуры были зарегистрированы
c4c dev logs --json --event procedure_registered | \
  jq -r '.lines[] | .procedure'
```

### Сценарий 4: Полный цикл разработки агента

```typescript
// agent-workflow.ts
import { execSync } from "child_process";

// 1. Убедиться что сервер запущен
const ensureServer = () => {
  const result = execSync("c4c dev --ensure --agent", { encoding: "utf-8" });
  const data = JSON.parse(result);
  return data.status.port;
};

// 2. Получить список процедур
const getProcedures = async (port: number) => {
  const response = await fetch(`http://localhost:${port}/procedures`);
  const { procedures } = await response.json();
  return procedures;
};

// 3. Выполнить задачу
const executeTask = async (port: number) => {
  // Ваша логика
};

// 4. Проверить логи на ошибки
const checkLogs = () => {
  const logs = execSync("c4c dev logs --json --level error", { encoding: "utf-8" });
  const data = JSON.parse(logs);
  return data.summary.errors === 0;
};

// Main
const main = async () => {
  const port = ensureServer();
  console.log(`Server running on port ${port}`);
  
  const procedures = await getProcedures(port);
  console.log(`Found ${procedures.length} procedures`);
  
  await executeTask(port);
  
  if (!checkLogs()) {
    console.error("Task completed with errors, check logs");
    process.exit(1);
  }
  
  console.log("Task completed successfully");
};

main();
```

## RPC Endpoints для программного доступа

Если вы знаете порт, можете использовать RPC:

```bash
# Получить статус
curl -X POST http://localhost:3000/rpc/dev.control.status

# Получить логи
curl -X POST http://localhost:3000/rpc/dev.control.logs \
  -H "Content-Type: application/json" \
  -d '{"tail": 10}'

# Остановить сервер
curl -X POST http://localhost:3000/rpc/dev.control.stop \
  -H "Content-Type: application/json" \
  -d '{"reason": "agent-initiated-shutdown"}'
```

## Коды ошибок

При использовании `--json` или `--agent`, ошибки возвращаются в структурированном виде:

```json
{
  "success": false,
  "error": {
    "code": "DEV_SERVER_ALREADY_RUNNING",
    "message": "A c4c dev server is already running",
    "details": {
      "pid": 12345,
      "port": 3000
    },
    "suggestions": [
      "Run 'c4c dev stop' to stop the existing server",
      "Use 'c4c dev --ensure' to start only if not running"
    ]
  }
}
```

**Возможные коды:**
- `DEV_SERVER_ALREADY_RUNNING` - сервер уже запущен
- `DEV_SERVER_NOT_FOUND` - сервер не найден
- `DEV_SERVER_STARTING` - сервер в процессе запуска
- `DEV_SERVER_UNHEALTHY` - сервер не отвечает на health check
- `PORT_IN_USE` - порт занят
- `HANDLERS_NOT_FOUND` - handlers директория не найдена
- `INVALID_MODE` - неверный режим запуска

## Best Practices для агентов

### ✅ DO

```bash
# 1. Всегда используйте --json для парсинга
c4c dev status --json

# 2. Используйте --ensure вместо перезапуска
c4c dev --ensure --agent

# 3. Фильтруйте логи по уровню
c4c dev logs --json --level error

# 4. Проверяйте health перед использованием
STATUS=$(c4c dev status --json)
if [ "$(echo $STATUS | jq -r '.health')" = "ok" ]; then
  # Используем сервер
fi
```

### ❌ DON'T

```bash
# 1. Не парсите текстовый вывод
c4c dev status | grep "Port:"  # ❌

# 2. Не перезапускайте без проверки
c4c dev stop && c4c dev  # ❌

# 3. Не читайте внутренние файлы напрямую
cat .c4c/dev/session.json  # ❌

# 4. Не используйте grep для логов
c4c dev logs | grep "error"  # ❌
```

## Интеграция с другими инструментами

### jq (парсинг JSON)

```bash
# Получить только порт
c4c dev status --json | jq -r '.port'

# Получить все endpoints
c4c dev status --json | jq '.endpoints'

# Подсчитать ошибки
c4c dev logs --json | jq '.summary.errors'
```

### Python

```python
import subprocess
import json

def get_dev_status():
    result = subprocess.run(
        ["c4c", "dev", "status", "--json"],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

status = get_dev_status()
if status["running"]:
    print(f"Server on port {status['port']}")
```

### Node.js

```javascript
import { execSync } from "child_process";

const getDevStatus = () => {
  const output = execSync("c4c dev status --json", { encoding: "utf-8" });
  return JSON.parse(output);
};

const status = getDevStatus();
if (status.running) {
  console.log(`Server on port ${status.port}`);
}
```

## Миграционный путь

### Текущий способ (до улучшений)

```bash
# Агент не уверен запущен ли сервер
c4c dev 2>&1 | grep "already running"
if [ $? -eq 0 ]; then
  # Наверное запущен, но на каком порту?
  # Попробуем 3000
  PORT=3000
else
  PORT=3000
fi
```

### Новый способ (после улучшений)

```bash
# Агент уверен и имеет точную информацию
STATUS=$(c4c dev --ensure --agent)
PORT=$(echo $STATUS | jq -r '.status.port')
```

## Производительность

| Операция | Время |
|----------|-------|
| `c4c dev status --json` | ~50ms |
| `c4c dev --ensure` (уже запущен) | ~100ms |
| `c4c dev --ensure` (запуск) | ~2-3s |
| `c4c dev logs --json --tail 100` | ~100ms |
| RPC `dev.control.status` | ~10ms |

## Заключение

Эти команды превращают c4c CLI из human-oriented в agent-friendly без потери функциональности для людей.

**Ключевые преимущества для агентов:**
- 🎯 Детерминированный вывод (JSON)
- 🔄 Идемпотентные операции
- 📊 Структурированные данные
- ⚡ Быстрые проверки статуса
- 🛡️ Понятные коды ошибок
