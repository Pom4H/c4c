# 🎯 Финальное упрощенное решение: CLI для агентов

## Максимально простое решение

### ❌ НЕ нужно

1. ~~Флаг `--agent`~~ - избыточен
2. ~~`userType` в метаданных~~ - не используется
3. ~~RPC процедуры по HTTP~~ - overhead
4. ~~Флаг `--ensure`~~ - агент сам проверит статус

### ✅ Только необходимое

1. **`c4c dev status --json`** - проверка состояния
2. **`c4c dev logs --json`** - структурированные логи
3. **`c4c dev stop`** - остановка через файл
4. **Агент сам решает** - запускать или нет на основе статуса

## 3 команды (вместо 4)

```bash
# 1. Проверить статус
c4c dev status --json
# → {"running":false} или {"running":true,"port":3000}

# 2. Логи (если нужно)
c4c dev logs --json --level error
# → {"lines":[...],"summary":{"errors":1}}

# 3. Остановка
c4c dev stop
# → пишет в .c4c/dev/commands.txt
```

## Логика агента

**Вместо:**
```bash
# Было: используем --ensure
c4c dev --ensure --json
```

**Делаем:**
```bash
# Стало: агент сам проверяет
STATUS=$(c4c dev status --json)
if [ "$(echo $STATUS | jq -r '.running')" != "true" ]; then
  c4c dev &
  sleep 2  # Дать время запуститься
fi

# Теперь получаем порт
PORT=$(c4c dev status --json | jq -r '.port')
```

## Преимущества

### Проще для CLI

**Было:**
```typescript
// Нужна сложная логика ensure
if (options.ensure) {
  const session = await discoverActiveSession(rootDir);
  if (session) {
    // Вернуть статус
  } else {
    // Запустить
  }
}
```

**Стало:**
```typescript
// Просто статус, агент сам решает
export async function devStatusCommand(options: { json?: boolean }) {
  const session = await discoverActiveSession(process.cwd());
  
  if (options.json) {
    console.log(JSON.stringify({
      running: !!session,
      port: session?.metadata.port,
      pid: session?.metadata.pid,
    }));
  } else {
    console.log(session 
      ? `[c4c] Running on port ${session.metadata.port}`
      : `[c4c] Not running`
    );
  }
}
```

### Проще для агента

Агент **явно контролирует** логику:

```typescript
// Явная логика - понятно что происходит
const status = await getDevStatus();

if (!status.running) {
  console.log("Starting dev server...");
  await startDevServer();
  await sleep(2000);
  status = await getDevStatus(); // Проверяем еще раз
}

console.log(`Using server on port ${status.port}`);
```

Вместо **неявной** логики в `--ensure`:

```typescript
// Неявно - что делает ensure?
const result = await exec("c4c dev --ensure --json");
// Запустил? Не запустил? Проверил? Что именно произошло?
```

## Примеры использования

### Bash агент

```bash
#!/bin/bash

# Функция для получения статуса
get_status() {
  c4c dev status --json
}

# Функция для запуска
ensure_running() {
  local status=$(get_status)
  
  if [ "$(echo $status | jq -r '.running')" != "true" ]; then
    echo "Starting dev server..."
    c4c dev &
    sleep 3
    
    # Проверяем что запустился
    status=$(get_status)
    if [ "$(echo $status | jq -r '.running')" != "true" ]; then
      echo "Failed to start dev server"
      exit 1
    fi
  fi
  
  echo $status | jq -r '.port'
}

# Использование
PORT=$(ensure_running)
echo "Server running on port $PORT"

# Работаем с API
curl http://localhost:$PORT/procedures

# Останавливаем
c4c dev stop
```

### TypeScript агент

```typescript
import { execSync } from "child_process";

interface DevStatus {
  running: boolean;
  port?: number;
  pid?: number;
}

function getDevStatus(): DevStatus {
  try {
    const result = execSync("c4c dev status --json", { encoding: "utf-8" });
    return JSON.parse(result);
  } catch {
    return { running: false };
  }
}

async function ensureDevServer(): Promise<number> {
  let status = getDevStatus();
  
  if (!status.running) {
    console.log("Starting dev server...");
    
    // Запускаем в фоне
    execSync("c4c dev &", { stdio: "ignore" });
    
    // Ждем запуска
    await sleep(3000);
    
    // Проверяем
    status = getDevStatus();
    if (!status.running) {
      throw new Error("Failed to start dev server");
    }
  }
  
  return status.port!;
}

// Использование
async function main() {
  const port = await ensureDevServer();
  console.log(`Server on port ${port}`);
  
  // Работаем
  const procedures = await fetch(`http://localhost:${port}/procedures`);
  console.log(await procedures.json());
  
  // Останавливаем
  execSync("c4c dev stop");
}
```

### Python агент

```python
import subprocess
import json
import time

def get_dev_status():
    try:
        result = subprocess.run(
            ["c4c", "dev", "status", "--json"],
            capture_output=True,
            text=True,
            check=True
        )
        return json.loads(result.stdout)
    except:
        return {"running": False}

def ensure_dev_server():
    status = get_dev_status()
    
    if not status.get("running"):
        print("Starting dev server...")
        
        # Запускаем в фоне
        subprocess.Popen(
            ["c4c", "dev"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        
        # Ждем запуска
        time.sleep(3)
        
        # Проверяем
        status = get_dev_status()
        if not status.get("running"):
            raise Exception("Failed to start dev server")
    
    return status["port"]

# Использование
port = ensure_dev_server()
print(f"Server on port {port}")

# Работаем с API
import requests
procedures = requests.get(f"http://localhost:{port}/procedures").json()

# Останавливаем
subprocess.run(["c4c", "dev", "stop"])
```

## Реализация

### 1. `c4c dev status --json`

```typescript
// apps/cli/src/commands/dev.ts

interface DevStatusOptions {
  root?: string;
  json?: boolean;
}

export async function devStatusCommand(options: DevStatusOptions): Promise<void> {
  const rootDir = resolve(options.root ?? process.cwd());
  const session = await discoverActiveSession(rootDir);
  
  const statusData = {
    running: !!session,
    ...(session && {
      pid: session.metadata.pid,
      port: session.metadata.port,
      mode: session.metadata.mode,
      uptime: formatUptime(Date.now() - Date.parse(session.metadata.startedAt)),
    }),
  };
  
  if (options.json) {
    console.log(JSON.stringify(statusData, null, 2));
  } else {
    if (session) {
      console.log(`[c4c] Dev server running on port ${session.metadata.port}`);
      console.log(`  PID: ${session.metadata.pid}, Uptime: ${statusData.uptime}`);
    } else {
      console.log("[c4c] No running dev server found.");
    }
  }
}
```

### 2. `c4c dev logs --json`

```typescript
interface DevLogsOptions {
  root?: string;
  json?: boolean;
  tail?: number;
  level?: "error" | "warn" | "info";
}

export async function devLogsCommand(options: DevLogsOptions): Promise<void> {
  const rootDir = resolve(options.root ?? process.cwd());
  const result = await readDevLogs({ projectRoot: rootDir, tail: options.tail });
  
  if (!result) {
    if (options.json) {
      console.log(JSON.stringify({ running: false }));
    } else {
      console.log("[c4c] No running dev server found.");
    }
    return;
  }
  
  if (options.json) {
    const structured = result.lines
      .map(parseLogLine)
      .filter(line => !options.level || line.level === options.level);
    
    console.log(JSON.stringify({
      running: true,
      lines: structured,
      summary: {
        total: structured.length,
        errors: structured.filter(l => l.level === "error").length,
        warnings: structured.filter(l => l.level === "warn").length,
      }
    }, null, 2));
  } else {
    for (const line of result.lines) {
      console.log(line);
    }
  }
}
```

### 3. `c4c dev stop`

```typescript
export async function stopDevServer(projectRoot: string): Promise<void> {
  const session = await discoverActiveSession(projectRoot);
  if (!session) {
    console.log("[c4c] No running dev server found.");
    return;
  }
  
  // Пишем команду stop в файл
  const commandFile = join(session.paths.directory, 'commands.txt');
  await fs.appendFile(commandFile, 'stop\n', 'utf8');
  
  // Ждем остановки
  const exited = await waitForProcessExit(session.metadata.pid, 5000);
  
  if (exited) {
    await removeDevSessionArtifacts(session.paths);
    console.log("[c4c] Dev server stopped.");
  } else {
    console.warn("[c4c] Server is still shutting down...");
  }
}
```

### 4. Чтение команд в dev процессе

```typescript
// apps/cli/src/lib/server.ts

export async function dev(mode: ServeMode, options: ServeOptions = {}) {
  // ... setup ...
  
  // Создаем файл для команд
  const commandFile = join(sessionPaths.directory, 'commands.txt');
  await fs.writeFile(commandFile, '', 'utf8');
  
  // Следим за командами через file watcher
  let lastSize = 0;
  const watcher = watch(commandFile, async () => {
    try {
      const content = await fs.readFile(commandFile, 'utf8');
      const newContent = content.slice(lastSize);
      lastSize = content.length;
      
      const commands = newContent.split('\n').filter(Boolean);
      for (const cmd of commands) {
        if (cmd.trim() === 'stop') {
          console.log('[c4c] Stop command received');
          triggerShutdown('command');
        }
      }
    } catch (error) {
      // Ignore errors
    }
  });
  
  // Cleanup
  controller.signal.addEventListener('abort', () => {
    watcher.close();
  });
  
  // ... остальной код сервера ...
}
```

## Регистрация команд

```typescript
// apps/cli/src/bin.ts

const devCommandDef = program
  .command("dev")
  .description("Start c4c dev server with watch mode")
  .argument("[mode]", "Mode (all|rest|workflow|rpc)", "all")
  .option("-p, --port <number>", "Port", parsePort)
  .option("--root <path>", "Project root", process.cwd())
  .option("--json", "JSON output")
  .action(async (modeArg, options) => {
    await devCommand(modeArg, options);
  });

devCommandDef
  .command("status")
  .description("Show dev server status")
  .option("--root <path>", "Project root", process.cwd())
  .option("--json", "JSON output")
  .action(async (options) => {
    await devStatusCommand(options);
  });

devCommandDef
  .command("logs")
  .description("Show dev server logs")
  .option("--root <path>", "Project root", process.cwd())
  .option("--tail <number>", "Number of lines")
  .option("--json", "JSON output")
  .option("--level <level>", "Filter by level (error|warn|info)")
  .action(async (options) => {
    await devLogsCommand(options);
  });

devCommandDef
  .command("stop")
  .description("Stop dev server")
  .option("--root <path>", "Project root", process.cwd())
  .action(async (options) => {
    await devStopCommand(options);
  });
```

## Итоговая архитектура

```
┌─────────────────────────────────┐
│ Команды (3 штуки)               │
│                                 │
│ c4c dev status --json           │ ← Агент проверяет
│ c4c dev logs --json             │
│ c4c dev stop                    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ .c4c/dev/                       │
│                                 │
│ session.json  ← PID, port       │
│ dev.log       ← Логи            │
│ commands.txt  ← Stop команда    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Dev процесс                     │
│                                 │
│ - Следит за commands.txt        │
│ - Обрабатывает stop             │
│ - Пишет логи                    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Агент                           │
│                                 │
│ 1. status --json → not running  │
│ 2. c4c dev (запуск)             │
│ 3. status --json → port 3000    │
│ 4. Работа с API                 │
│ 5. dev stop                     │
└─────────────────────────────────┘
```

## Сравнение подходов

### Подход 1: Флаг --ensure (отвергнут)

```bash
# CLI делает всю работу
c4c dev --ensure --json

# Проблемы:
# - Неявная логика (что делает ensure?)
# - CLI решает за агента
# - Сложнее код CLI
```

### Подход 2: Агент проверяет статус (выбран) ✅

```bash
# Агент контролирует логику
STATUS=$(c4c dev status --json)
if [ "$(echo $STATUS | jq -r '.running')" != "true" ]; then
  c4c dev &
fi

# Преимущества:
# + Явная логика
# + Агент контролирует
# + Проще код CLI
# + Понятнее что происходит
```

## Что убрали (итого)

```diff
# Флаги
- --agent     # Не нужен, есть --json
- --ensure    # Агент сам проверит статус

# Метаданные
- userType: DevUserType  # Не используется

# RPC процедуры
- dev.control.stop    # Используем файл
- dev.control.logs    # Используем файл
- dev.control.status  # Используем файл

# Сложная логика
- if (options.ensure) { ... }  # Агент сам решает
- if (userType === "agent") { ... }  # Не нужно
```

## Что добавили (минимум)

```diff
# Флаг --json (везде)
+ .option("--json", "JSON output")

# Файл команд
+ const commandFile = '.c4c/dev/commands.txt';
+ watch(commandFile, () => { handleCommand() });

# Парсинг логов
+ function parseLogLine(raw: string): StructuredLogLine
```

## Финальный чеклист

### Week 1 (4 дня вместо 5-7)

**День 1-2: Основные команды**
- [ ] `c4c dev status --json`
  - [ ] Чтение session.json
  - [ ] JSON формат вывода
  - [ ] Текстовый формат (опционально)

**День 3: Логи**
- [ ] `c4c dev logs --json`
  - [ ] Парсинг логов в структурированный формат
  - [ ] Фильтрация по `--level`
  - [ ] Опция `--tail`

**День 4: Управление**
- [ ] `c4c dev stop` через файл
  - [ ] Создание commands.txt
  - [ ] File watcher в dev процессе
  - [ ] Graceful shutdown

**Опционально (1 день)**
- [ ] Улучшенный парсинг логов
- [ ] Тесты

**Итого: 4-5 дней** (было 5-7, стало еще проще!)

## Метрики упрощения

| Параметр | С --ensure | Без --ensure | Улучшение |
|----------|------------|--------------|-----------|
| Строк кода | +300 | +200 | **-33%** |
| Команд | 4 | 3 | **-25%** |
| Концепций | ensure, json | json | **-50%** |
| Ясность | ❓ что делает | ✅ понятно | **100%** |

## Выводы

### ✅ Максимальное упрощение достигнуто

1. **3 команды** вместо 4-8
2. **Только `--json`** вместо `--agent`, `--ensure`, etc
3. **Агент контролирует** логику запуска
4. **Проще код** - меньше условий и флагов
5. **Понятнее** - явная логика вместо неявной

### ✅ Рекомендация

**Реализовать финальное упрощенное решение:**
- `c4c dev status --json` - проверка статуса
- `c4c dev logs --json` - структурированные логи
- `c4c dev stop` - остановка через файл
- Агент сам проверяет и запускает при необходимости

**Время разработки: 4-5 дней**

---

**Документ:** FINAL_SIMPLIFIED_SOLUTION.md  
**Дата:** 21 октября 2025  
**Статус:** ✅ Готово к реализации  
**Команд:** 3 (минимум!)
