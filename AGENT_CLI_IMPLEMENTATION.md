# Техническая спецификация: CLI для агентов

## Обзор изменений

Добавление команд и функционала для улучшения DX агентов при работе с c4c dev server.

## 1. Команда `c4c dev status`

### Файл: `apps/cli/src/commands/dev.ts`

```typescript
interface DevStatusOptions {
  root?: string;
  json?: boolean;
}

export async function devStatusCommand(options: DevStatusOptions): Promise<void> {
  const rootDir = resolve(options.root ?? process.cwd());
  const session = await discoverActiveSession(rootDir);
  
  // Определяем формат вывода
  const isAgentMode = session?.metadata.userType === "agent";
  const useJson = options.json ?? isAgentMode;
  
  if (!session) {
    if (useJson) {
      console.log(JSON.stringify({ running: false, message: "No dev server found" }, null, 2));
    } else {
      console.log("[c4c] No running dev server found.");
    }
    return;
  }
  
  const { metadata } = session;
  const uptime = Date.now() - Date.parse(metadata.startedAt);
  const uptimeStr = formatUptime(uptime);
  
  // Проверяем health
  const health = await checkServerHealth(metadata);
  
  const statusData = {
    running: true,
    pid: metadata.pid,
    port: metadata.port,
    mode: metadata.mode,
    userType: metadata.userType,
    startedAt: metadata.startedAt,
    uptime: uptimeStr,
    uptimeMs: uptime,
    projectRoot: metadata.projectRoot,
    handlersPath: metadata.handlersPath,
    health: health ? "ok" : "degraded",
    endpoints: {
      rpc: `http://localhost:${metadata.port}/rpc`,
      procedures: `http://localhost:${metadata.port}/procedures`,
      workflow: `http://localhost:${metadata.port}/workflow`,
      health: `http://localhost:${metadata.port}/health`,
      docs: `http://localhost:${metadata.port}/docs`,
    },
  };
  
  if (useJson) {
    console.log(JSON.stringify(statusData, null, 2));
  } else {
    console.log(`[c4c] Dev server status:`);
    console.log(`  Running:   ${statusData.running ? "✓" : "✗"}`);
    console.log(`  PID:       ${statusData.pid}`);
    console.log(`  Port:      ${statusData.port}`);
    console.log(`  Mode:      ${statusData.mode}`);
    console.log(`  Uptime:    ${statusData.uptime}`);
    console.log(`  Health:    ${statusData.health}`);
    console.log(`\n  Endpoints:`);
    console.log(`    Procedures: ${statusData.endpoints.procedures}`);
    console.log(`    RPC:        ${statusData.endpoints.rpc}`);
    console.log(`    Docs:       ${statusData.endpoints.docs}`);
  }
}

async function checkServerHealth(metadata: DevSessionMetadata): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    const response = await fetch(`http://localhost:${metadata.port}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
```

### Регистрация команды в `apps/cli/src/bin.ts`

```typescript
devCommandDef
  .command("status")
  .description("Show dev server status")
  .option("--root <path>", "Project root containing handlers/", process.cwd())
  .option("--json", "Output in JSON format")
  .action(async (options) => {
    try {
      await devStatusCommand(options);
    } catch (error) {
      console.error(
        `[c4c] ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });
```

## 2. Улучшенная команда `c4c dev logs --json`

### Файл: `apps/cli/src/lib/logs.ts`

```typescript
export interface DevLogsOptions {
  projectRoot: string;
  tail?: number;
  json?: boolean;
  level?: "error" | "warn" | "info" | "debug";
  event?: string;
  since?: string;
}

export interface StructuredLogLine {
  timestamp: string;
  level: "error" | "warn" | "info" | "debug";
  message: string;
  raw: string;
  event?: string;
  procedure?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface DevLogsResult {
  running: boolean;
  logFile?: string;
  lines: StructuredLogLine[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    procedures?: {
      registered: number;
      updated: number;
      removed: number;
    };
  };
}

export async function readDevLogsStructured(
  options: DevLogsOptions
): Promise<DevLogsResult | null> {
  const resolved = await discoverActiveSession(options.projectRoot);
  if (!resolved) {
    return null;
  }
  
  const { paths: sessionPaths, metadata } = resolved;
  
  // Читаем логи (используем существующую функцию)
  const basicResult = await readDevLogs({
    projectRoot: options.projectRoot,
    tail: options.tail,
  });
  
  if (!basicResult) {
    return null;
  }
  
  // Парсим строки в структурированный формат
  const structuredLines = basicResult.lines
    .map(parseLogLine)
    .filter((line) => {
      if (options.level && line.level !== options.level) return false;
      if (options.event && line.event !== options.event) return false;
      if (options.since) {
        const sinceMs = parseDuration(options.since);
        const lineTime = Date.parse(line.timestamp);
        if (Date.now() - lineTime > sinceMs) return false;
      }
      return true;
    });
  
  // Собираем статистику
  const summary = {
    total: structuredLines.length,
    errors: structuredLines.filter((l) => l.level === "error").length,
    warnings: structuredLines.filter((l) => l.level === "warn").length,
    procedures: {
      registered: structuredLines.filter((l) => l.event === "procedure_registered").length,
      updated: structuredLines.filter((l) => l.event === "procedure_updated").length,
      removed: structuredLines.filter((l) => l.event === "procedure_removed").length,
    },
  };
  
  return {
    running: true,
    logFile: sessionPaths.logFile,
    lines: structuredLines,
    summary,
  };
}

function parseLogLine(raw: string): StructuredLogLine {
  // Default структура
  const line: StructuredLogLine = {
    timestamp: new Date().toISOString(),
    level: "info",
    message: raw,
    raw,
  };
  
  // Извлекаем timestamp если есть
  const timestampMatch = raw.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
  if (timestampMatch) {
    line.timestamp = timestampMatch[1];
  }
  
  // Определяем level
  if (raw.includes("[ERROR]") || raw.toLowerCase().includes("error")) {
    line.level = "error";
  } else if (raw.includes("[WARN]") || raw.toLowerCase().includes("warning")) {
    line.level = "warn";
  } else if (raw.includes("[DEBUG]")) {
    line.level = "debug";
  }
  
  // Парсим события Registry
  const registryMatch = raw.match(/\[Registry\] ([+~-]) ([^\s]+)/);
  if (registryMatch) {
    const action = registryMatch[1];
    const procedureName = registryMatch[2];
    
    line.procedure = procedureName;
    
    if (action === "+") {
      line.event = "procedure_registered";
      line.message = `Registered procedure ${procedureName}`;
    } else if (action === "~") {
      line.event = "procedure_updated";
      line.message = `Updated procedure ${procedureName}`;
    } else if (action === "-") {
      line.event = "procedure_removed";
      line.message = `Removed procedure ${procedureName}`;
    }
    
    // Извлекаем метаданные
    const metadataMatch = raw.match(/\[([^\]]+)\]/g);
    if (metadataMatch && metadataMatch.length > 1) {
      line.metadata = {
        exposure: metadataMatch.find((m) => m.includes("external")) ? "external" : undefined,
        auth: metadataMatch.find((m) => m.includes("auth")) ? true : undefined,
      };
    }
  }
  
  // Парсим ошибки процедур
  const procErrorMatch = raw.match(/Error in procedure ([^\s:]+):?\s*(.+)?/);
  if (procErrorMatch) {
    line.event = "procedure_error";
    line.procedure = procErrorMatch[1];
    line.error = procErrorMatch[2] || "Unknown error";
    line.level = "error";
    line.message = `Error in procedure ${line.procedure}: ${line.error}`;
  }
  
  return line;
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(ms|s|m|h|d)?$/);
  if (!match) return 0;
  
  const value = parseInt(match[1], 10);
  const unit = match[2] || "ms";
  
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  
  return value * (multipliers[unit] || 1);
}
```

### Обновление команды в `apps/cli/src/commands/dev.ts`

```typescript
interface DevLogsOptions {
  root?: string;
  tail?: number;
  json?: boolean;
  level?: "error" | "warn" | "info" | "debug";
  event?: string;
  since?: string;
}

export async function devLogsCommand(options: DevLogsOptions): Promise<void> {
  const rootDir = resolve(options.root ?? process.cwd());
  
  // Проверяем, нужен ли JSON формат
  const session = await discoverActiveSession(rootDir);
  const isAgentMode = session?.metadata.userType === "agent";
  const useJson = options.json ?? isAgentMode;
  
  if (useJson) {
    // Структурированный вывод
    const result = await readDevLogsStructured({
      projectRoot: rootDir,
      tail: options.tail,
      json: true,
      level: options.level,
      event: options.event,
      since: options.since,
    });
    
    if (!result) {
      console.log(JSON.stringify({ running: false, message: "No dev server found" }, null, 2));
      return;
    }
    
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Текстовый вывод (как раньше)
    const result = await readDevLogs({ projectRoot: rootDir, tail: options.tail });
    if (!result) {
      console.log(`[c4c] No running dev server found.`);
      return;
    }
    
    for (const line of result.lines) {
      console.log(line);
    }
  }
}
```

### Обновление регистрации в `apps/cli/src/bin.ts`

```typescript
devCommandDef
  .command("logs")
  .description("Print stdout logs from the running c4c dev server")
  .option("--root <path>", "Project root containing handlers/", process.cwd())
  .option("--tail <number>", "Number of log lines from the end of the file to display")
  .option("--json", "Output in JSON format")
  .option("--level <level>", "Filter by log level (error, warn, info, debug)")
  .option("--event <event>", "Filter by event type (procedure_registered, procedure_error, etc)")
  .option("--since <duration>", "Show logs from the last duration (e.g., 5m, 1h)")
  .action(async (options) => {
    try {
      await devLogsCommand(options);
    } catch (error) {
      console.error(
        `[c4c] ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });
```

## 3. Идемпотентная команда `c4c dev --ensure`

### Файл: `apps/cli/src/commands/dev.ts`

```typescript
interface DevCommandOptions {
  port?: number;
  root?: string;
  handlers?: string;
  workflows?: string;
  docs?: boolean;
  disableDocs?: boolean;
  quiet?: boolean;
  agent?: boolean;
  ensure?: boolean; // NEW
}

export async function devCommand(modeArg: string, options: DevCommandOptions): Promise<void> {
  if (!isServeMode(modeArg)) {
    throw new Error(`Unknown dev mode '${modeArg}'.`);
  }
  
  const rootDir = resolve(options.root ?? process.cwd());
  
  // Режим --ensure: проверяем запущен ли сервер
  if (options.ensure) {
    const session = await discoverActiveSession(rootDir);
    const isAgentMode = options.agent ?? session?.metadata.userType === "agent";
    
    if (session) {
      // Проверяем health
      const healthy = await checkServerHealth(session.metadata);
      
      const result = {
        action: "already_running",
        message: "Dev server is already running",
        status: {
          running: true,
          pid: session.metadata.pid,
          port: session.metadata.port,
          mode: session.metadata.mode,
          uptime: formatUptime(Date.now() - Date.parse(session.metadata.startedAt)),
          health: healthy ? "ok" : "degraded",
        },
      };
      
      if (isAgentMode) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`[c4c] Dev server is already running (pid ${session.metadata.pid})`);
        console.log(`[c4c] Port: ${session.metadata.port}, Mode: ${session.metadata.mode}`);
      }
      
      // Если нездоров, перезапускаем
      if (!healthy) {
        console.log(`[c4c] Server health check failed, restarting...`);
        await stopDevServer(rootDir);
        // Продолжаем с запуском ниже
      } else {
        return; // Все ОК, выходим
      }
    }
    
    // Если не запущен, запускаем (код ниже выполнится)
  }
  
  // Обычная логика запуска (существующий код)
  const handlersPath = determineHandlersPath(rootDir, options.handlers);
  const workflowsPath = determineWorkflowsPath(rootDir, options.workflows);
  
  if (options.quiet) {
    process.env.C4C_QUIET = "1";
  }
  
  const enableDocs = options.docs ? true : options.disableDocs ? false : undefined;
  const userType: DevUserType = options.agent ? "agent" : "human";
  
  const serveOptions: ServeOptions = {
    port: options.port,
    handlersPath,
    workflowsPath,
    enableDocs,
    projectRoot: rootDir,
    userType,
  };
  
  await runDev(modeArg, serveOptions);
  
  // Если --ensure и агент, выводим статус после запуска
  if (options.ensure && options.agent) {
    // Ждем немного, чтобы сервер запустился
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const session = await discoverActiveSession(rootDir);
    if (session) {
      const result = {
        action: "started",
        message: "Dev server started",
        status: {
          running: true,
          pid: session.metadata.pid,
          port: session.metadata.port,
          mode: session.metadata.mode,
          uptime: "0s",
        },
      };
      console.log(JSON.stringify(result, null, 2));
    }
  }
}
```

### Обновление регистрации в `apps/cli/src/bin.ts`

```typescript
const devCommandDef = program
  .command("dev")
  .description("Start the c4c HTTP server with watch mode")
  .argument("[mode]", "Mode to run (all|rest|workflow|rpc)", "all")
  .option("-p, --port <number>", "Port to listen on", parsePort)
  .option("--root <path>", "Project root containing handlers/", process.cwd())
  .option("--handlers <path>", "Custom handlers directory (overrides root)")
  .option("--workflows <path>", "Custom workflows directory (overrides root)")
  .option("--docs", "Force enable docs endpoints")
  .option("--disable-docs", "Disable docs endpoints")
  .option("--quiet", "Reduce startup logging")
  .option("--agent", "Mark this CLI invocation as running on behalf of an agent")
  .option("--ensure", "Idempotent: start if not running, check health if running") // NEW
  .action(async (modeArg: string, options) => {
    try {
      await devCommand(modeArg, options);
    } catch (error) {
      console.error(
        `[c4c] ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });
```

## 4. RPC процедура `dev.control.status`

### Файл: `apps/cli/src/internal/contracts/dev-control.ts`

```typescript
export const devControlStatusInput = z.object({});

export const devControlStatusOutput = z.object({
  running: z.literal(true),
  pid: z.number(),
  port: z.number(),
  mode: z.enum(["all", "rest", "workflow", "rpc"]),
  userType: z.enum(["agent", "human"]),
  startedAt: z.string(),
  uptime: z.string(),
  uptimeMs: z.number(),
  projectRoot: z.string(),
  handlersPath: z.string(),
  health: z.enum(["ok", "degraded"]),
  endpoints: z.object({
    rpc: z.string(),
    procedures: z.string(),
    workflow: z.string(),
    health: z.string(),
    docs: z.string(),
  }),
});

export const devControlStatusContract = {
  name: "dev.control.status",
  description: "Returns dev server status and configuration",
  input: devControlStatusInput,
  output: devControlStatusOutput,
  metadata: {
    exposure: "external",
    roles: ["sdk-client", "api-endpoint"],
    category: "devtools",
    tags: ["cli", "status"],
  },
} as unknown as Contract;
```

### Файл: `apps/cli/src/internal/handlers/dev-control.ts`

```typescript
export function createDevControlProcedures(
  options: DevControlHandlerOptions
): DevControlProcedureDescriptor[] {
  const { requestStop, logFile, sourcePath } = options;
  
  // Существующие процедуры (stop, logs)
  // ...
  
  // NEW: status procedure
  const statusProcedure = {
    contract: devControlStatusContract,
    handler: async () => {
      // Читаем session.json
      const sessionPaths = getDevSessionPaths(options.projectRoot || process.cwd());
      const metadata = await readDevSessionMetadata(sessionPaths);
      
      if (!metadata) {
        throw new Error("Dev server session metadata not found");
      }
      
      const uptime = Date.now() - Date.parse(metadata.startedAt);
      
      return {
        running: true,
        pid: metadata.pid,
        port: metadata.port,
        mode: metadata.mode,
        userType: metadata.userType,
        startedAt: metadata.startedAt,
        uptime: formatUptime(uptime),
        uptimeMs: uptime,
        projectRoot: metadata.projectRoot,
        handlersPath: metadata.handlersPath,
        health: "ok", // TODO: implement actual health check
        endpoints: {
          rpc: `http://localhost:${metadata.port}/rpc`,
          procedures: `http://localhost:${metadata.port}/procedures`,
          workflow: `http://localhost:${metadata.port}/workflow`,
          health: `http://localhost:${metadata.port}/health`,
          docs: `http://localhost:${metadata.port}/docs`,
        },
      } as const;
    },
  } as unknown as Procedure;
  
  return [
    { name: stopProcedure.contract.name, procedure: stopProcedure, sourcePath },
    { name: logsProcedure.contract.name, procedure: logsProcedure, sourcePath },
    { name: statusProcedure.contract.name, procedure: statusProcedure, sourcePath }, // NEW
  ];
}
```

### Обновление `apps/cli/src/lib/server.ts`

```typescript
const controlProcedures: DevControlProcedureDescriptor[] = createDevControlProcedures({
  requestStop: (reason) => {
    if (reason) {
      console.log(`[c4c] Stop requested: ${reason}`);
    } else {
      console.log("[c4c] Stop requested");
    }
    triggerShutdown("rpc");
  },
  logFile: sessionPaths.logFile,
  sourcePath: join(handlersPath, DEV_CONTROLS_LABEL),
  projectRoot: rootDir, // NEW - нужен для status
});
```

## 5. Структурированные коды ошибок

### Файл: `apps/cli/src/lib/errors.ts` (новый файл)

```typescript
export enum DevErrorCode {
  DEV_SERVER_ALREADY_RUNNING = "DEV_SERVER_ALREADY_RUNNING",
  DEV_SERVER_NOT_FOUND = "DEV_SERVER_NOT_FOUND",
  DEV_SERVER_STARTING = "DEV_SERVER_STARTING",
  DEV_SERVER_UNHEALTHY = "DEV_SERVER_UNHEALTHY",
  PORT_IN_USE = "PORT_IN_USE",
  HANDLERS_NOT_FOUND = "HANDLERS_NOT_FOUND",
  INVALID_MODE = "INVALID_MODE",
  INVALID_PORT = "INVALID_PORT",
}

export interface DevError {
  success: false;
  error: {
    code: DevErrorCode;
    message: string;
    details?: Record<string, unknown>;
    suggestions?: string[];
  };
}

export class DevCLIError extends Error {
  constructor(
    public code: DevErrorCode,
    message: string,
    public details?: Record<string, unknown>,
    public suggestions?: string[]
  ) {
    super(message);
    this.name = "DevCLIError";
  }
  
  toJSON(): DevError {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        suggestions: this.suggestions,
      },
    };
  }
}

export function formatError(error: DevCLIError, json: boolean): string {
  if (json) {
    return JSON.stringify(error.toJSON(), null, 2);
  }
  
  let output = `[c4c] Error: ${error.message}`;
  
  if (error.details) {
    output += `\n\nDetails:`;
    for (const [key, value] of Object.entries(error.details)) {
      output += `\n  ${key}: ${value}`;
    }
  }
  
  if (error.suggestions && error.suggestions.length > 0) {
    output += `\n\nSuggestions:`;
    for (const suggestion of error.suggestions) {
      output += `\n  • ${suggestion}`;
    }
  }
  
  return output;
}
```

### Использование в командах

```typescript
// apps/cli/src/lib/session.ts
export async function ensureDevSessionAvailability(paths: DevSessionPaths): Promise<void> {
  const existing = await readDevSessionMetadata(paths);
  if (!existing) return;

  const { pid, status, startedAt } = existing;
  const processAlive = Boolean(pid && isProcessAlive(pid));
  let serverResponsive = false;

  if (processAlive) {
    serverResponsive = await isDevServerResponsive(existing);
  }

  if (processAlive && serverResponsive) {
    throw new DevCLIError(
      DevErrorCode.DEV_SERVER_ALREADY_RUNNING,
      "A c4c dev server is already running",
      {
        pid,
        port: existing.port,
        startedAt: existing.startedAt,
      },
      [
        `Run 'c4c dev stop' to stop the existing server`,
        `Run 'c4c dev status' to check the server status`,
        `Use 'c4c dev --ensure' to start only if not running`,
      ]
    );
  }

  // ...
}
```

### Обработка ошибок в `apps/cli/src/bin.ts`

```typescript
devCommandDef
  .action(async (modeArg: string, options) => {
    try {
      await devCommand(modeArg, options);
    } catch (error) {
      // Проверяем, агентский режим или нет
      const isAgentMode = options.agent;
      
      if (error instanceof DevCLIError) {
        const formatted = formatError(error, isAgentMode);
        console.error(formatted);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        if (isAgentMode) {
          console.error(JSON.stringify({
            success: false,
            error: {
              code: "UNKNOWN_ERROR",
              message,
            }
          }, null, 2));
        } else {
          console.error(`[c4c] ${message}`);
        }
      }
      process.exit(1);
    }
  });
```

## 6. Тесты

### Файл: `apps/cli/src/commands/__tests__/dev-status.test.ts`

```typescript
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { devCommand, devStatusCommand, devStopCommand } from "../dev";

describe("c4c dev status", () => {
  test("returns not running when no server", async () => {
    const output = await captureOutput(() =>
      devStatusCommand({ root: "/tmp/test", json: true })
    );
    
    const result = JSON.parse(output);
    expect(result).toEqual({
      running: false,
      message: "No dev server found",
    });
  });
  
  test("returns status when server running", async () => {
    // Start server
    const serverProcess = await devCommand("all", {
      root: "/tmp/test",
      agent: true,
      quiet: true,
    });
    
    // Wait for startup
    await wait(1000);
    
    // Check status
    const output = await captureOutput(() =>
      devStatusCommand({ root: "/tmp/test", json: true })
    );
    
    const result = JSON.parse(output);
    expect(result.running).toBe(true);
    expect(result.port).toBeDefined();
    expect(result.endpoints).toBeDefined();
    
    // Cleanup
    await devStopCommand({ root: "/tmp/test" });
  });
  
  test("--json flag works", async () => {
    const output = await captureOutput(() =>
      devStatusCommand({ root: "/tmp/test", json: true })
    );
    
    expect(() => JSON.parse(output)).not.toThrow();
  });
  
  test("text output works for humans", async () => {
    const output = await captureOutput(() =>
      devStatusCommand({ root: "/tmp/test", json: false })
    );
    
    expect(output).toContain("[c4c]");
  });
});
```

### Файл: `apps/cli/src/commands/__tests__/dev-ensure.test.ts`

```typescript
describe("c4c dev --ensure", () => {
  test("starts server when not running", async () => {
    const output = await captureOutput(() =>
      devCommand("all", {
        root: "/tmp/test",
        ensure: true,
        agent: true,
      })
    );
    
    const result = JSON.parse(output);
    expect(result.action).toBe("started");
    expect(result.status.running).toBe(true);
    
    await devStopCommand({ root: "/tmp/test" });
  });
  
  test("returns existing server status when already running", async () => {
    // Start server
    await devCommand("all", { root: "/tmp/test", agent: true });
    await wait(1000);
    
    // Try to ensure again
    const output = await captureOutput(() =>
      devCommand("all", {
        root: "/tmp/test",
        ensure: true,
        agent: true,
      })
    );
    
    const result = JSON.parse(output);
    expect(result.action).toBe("already_running");
    expect(result.status.running).toBe(true);
    
    await devStopCommand({ root: "/tmp/test" });
  });
});
```

## 7. Документация

### Обновление `README.md`

```markdown
### CLI usage for AI Agents

c4c CLI provides agent-friendly commands with JSON output:

```bash
# Check dev server status
c4c dev status --json

# Start dev server (idempotent)
c4c dev --ensure --agent

# Read structured logs
c4c dev logs --json --level error --tail 10

# Stop dev server
c4c dev stop
```

**Agent mode:** When using `--agent` flag, all commands automatically output JSON.

**Status check:**
```bash
c4c dev status --json
# Returns:
# {"running":true,"port":3000,"endpoints":{...}}
```

**Logs with filtering:**
```bash
c4c dev logs --json --level error --event procedure_error
# Returns structured log data with summary
```

**Idempotent start:**
```bash
c4c dev --ensure --agent
# Starts server only if not already running
# Returns status in either case
```
```

### Новый файл: `AGENT_USAGE.md`

См. содержимое в основном файле анализа.

## Чеклист реализации

### Phase 1: MVP (Week 1)
- [ ] Команда `c4c dev status`
  - [ ] Основная функциональность
  - [ ] Флаг `--json`
  - [ ] Проверка health
  - [ ] Форматирование uptime
  - [ ] Тесты

- [ ] Улучшенная команда `c4c dev logs`
  - [ ] Флаг `--json`
  - [ ] Парсинг структурированных логов
  - [ ] Фильтры `--level`, `--event`, `--since`
  - [ ] Summary статистика
  - [ ] Тесты

- [ ] Команда `c4c dev --ensure`
  - [ ] Проверка существующего сервера
  - [ ] Проверка health
  - [ ] JSON вывод для агентов
  - [ ] Тесты

### Phase 2: Enhancements (Week 2)
- [ ] Флаг `--agent` меняет defaults
  - [ ] Определение userType из session
  - [ ] Автоматический JSON для агентов
  - [ ] Тесты

- [ ] Структурированные ошибки
  - [ ] DevCLIError class
  - [ ] Коды ошибок
  - [ ] Suggestions
  - [ ] JSON форматирование
  - [ ] Тесты

- [ ] RPC `dev.control.status`
  - [ ] Contract
  - [ ] Handler
  - [ ] Регистрация
  - [ ] Тесты

### Phase 3: Documentation
- [ ] README обновления
- [ ] AGENT_USAGE.md
- [ ] Примеры скриптов
- [ ] TypeScript SDK примеры

## Миграция

Все изменения обратно совместимы:

1. **Существующие команды** продолжают работать как раньше
2. **Новые флаги** опциональны
3. **JSON вывод** требует явного `--json` или `--agent`
4. **Ошибки** возвращаются в старом формате для human режима
