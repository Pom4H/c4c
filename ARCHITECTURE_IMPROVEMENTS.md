# Предложения по усилению архитектуры tsdev

## 📊 Анализ текущей архитектуры

### Сильные стороны
✅ **Contracts-first подход** - единый источник истины  
✅ **Transport-agnostic** - один обработчик для множества транспортов  
✅ **Автоматическая регистрация** - zero boilerplate через collectRegistry()  
✅ **OpenTelemetry интеграция** - observability встроена в ядро  
✅ **Composable policies** - расширяемость через функции  
✅ **Workflow система** - визуальные графы из процедур  

### Области для усиления
❌ **Тестирование** - отсутствует инфраструктура тестов  
❌ **Безопасность** - минимальная защита  
❌ **Обработка ошибок** - базовая, требует стандартизации  
❌ **Валидация** - только на границах, нет runtime проверок  
❌ **Масштабирование** - нет механизмов для распределенных систем  
❌ **Документация** - генерация есть, но не хватает примеров  
❌ **DX (Developer Experience)** - нужны инструменты разработчика  

---

## 🎯 Приоритетные улучшения

### 1. Тестовая инфраструктура (HIGH PRIORITY)

#### Проблема
- Нет unit/integration тестов
- Отсутствует test framework setup
- Нет примеров тестирования

#### Решение

**1.1. Создать пакет `@tsdev/testing`**

```typescript
// packages/testing/src/index.ts
import type { Procedure, Registry, ExecutionContext } from '@tsdev/core';

/**
 * Test utilities for tsdev
 */

// Mock registry builder
export function createMockRegistry(): Registry {
  return new Map();
}

// Test execution context builder
export function createTestContext(
  overrides: Partial<ExecutionContext> = {}
): ExecutionContext {
  return {
    requestId: 'test-req-123',
    timestamp: new Date('2024-01-01'),
    metadata: {},
    ...overrides,
  };
}

// Procedure test helper
export async function testProcedure<TInput, TOutput>(
  procedure: Procedure<TInput, TOutput>,
  input: TInput,
  context?: Partial<ExecutionContext>
) {
  const ctx = createTestContext(context);
  return procedure.handler(input, ctx);
}

// Contract validation tester
export function validateContract(
  procedure: Procedure,
  testCases: Array<{ input: unknown; expectedValid: boolean }>
) {
  const results = testCases.map(({ input, expectedValid }) => {
    try {
      procedure.contract.input.parse(input);
      return { input, valid: true, matches: expectedValid };
    } catch {
      return { input, valid: false, matches: !expectedValid };
    }
  });
  
  return {
    passed: results.every(r => r.matches),
    results,
  };
}

// HTTP adapter testing helper
export class TestHttpClient {
  constructor(private baseUrl: string) {}
  
  async callProcedure(name: string, input: unknown) {
    const response = await fetch(`${this.baseUrl}/rpc/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return response.json();
  }
}

// Workflow testing utilities
export function createMockWorkflow(
  overrides: Partial<WorkflowDefinition> = {}
): WorkflowDefinition {
  return {
    id: 'test-workflow',
    name: 'Test Workflow',
    version: '1.0.0',
    startNode: 'start',
    nodes: [],
    ...overrides,
  };
}
```

**1.2. Настроить vitest для всех пакетов**

```typescript
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/index.ts'],
    },
  },
});
```

**1.3. Примеры тестов**

```typescript
// packages/core/src/executor.test.ts
import { describe, it, expect, vi } from 'vitest';
import { executeProcedure, createExecutionContext } from './executor.js';
import { z } from 'zod';

describe('executeProcedure', () => {
  it('should validate input and output', async () => {
    const procedure = {
      contract: {
        name: 'test.add',
        input: z.object({ a: z.number(), b: z.number() }),
        output: z.object({ result: z.number() }),
      },
      handler: async (input: { a: number; b: number }) => ({
        result: input.a + input.b,
      }),
    };
    
    const context = createExecutionContext();
    const result = await executeProcedure(procedure, { a: 2, b: 3 }, context);
    
    expect(result).toEqual({ result: 5 });
  });
  
  it('should throw on invalid input', async () => {
    const procedure = {
      contract: {
        name: 'test.add',
        input: z.object({ a: z.number(), b: z.number() }),
        output: z.object({ result: z.number() }),
      },
      handler: async (input: { a: number; b: number }) => ({
        result: input.a + input.b,
      }),
    };
    
    const context = createExecutionContext();
    
    await expect(
      executeProcedure(procedure, { a: 'invalid' }, context)
    ).rejects.toThrow();
  });
});
```

---

### 2. Стандартизация обработки ошибок (HIGH PRIORITY)

#### Проблема
- Нет единой системы ошибок
- Ошибки не типизированы
- Отсутствуют error codes
- Нет recovery механизмов

#### Решение

**2.1. Создать систему typed errors**

```typescript
// packages/core/src/errors.ts

/**
 * Base error class for tsdev framework
 */
export class TsdevError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// Domain-specific errors
export class ValidationError extends TsdevError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class ProcedureNotFoundError extends TsdevError {
  constructor(procedureName: string) {
    super(
      `Procedure '${procedureName}' not found`,
      'PROCEDURE_NOT_FOUND',
      404,
      { procedureName }
    );
  }
}

export class ExecutionError extends TsdevError {
  constructor(message: string, cause?: Error) {
    super(message, 'EXECUTION_ERROR', 500, {
      cause: cause?.message,
      stack: cause?.stack,
    });
  }
}

export class RateLimitError extends TsdevError {
  constructor(retryAfter?: number) {
    super(
      'Rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      429,
      { retryAfter }
    );
  }
}

export class AuthenticationError extends TsdevError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class AuthorizationError extends TsdevError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

export class TimeoutError extends TsdevError {
  constructor(timeoutMs: number) {
    super(
      `Operation timed out after ${timeoutMs}ms`,
      'TIMEOUT_ERROR',
      408,
      { timeoutMs }
    );
  }
}

// Error handler utility
export function handleError(error: unknown): TsdevError {
  if (error instanceof TsdevError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new ExecutionError(error.message, error);
  }
  
  return new ExecutionError(String(error));
}
```

**2.2. Обновить executor с обработкой ошибок**

```typescript
// packages/core/src/executor.ts
import { ValidationError, ExecutionError, handleError } from './errors.js';

export async function executeProcedure<TInput, TOutput>(
  procedure: Procedure<TInput, TOutput>,
  input: unknown,
  context: ExecutionContext
): Promise<TOutput> {
  try {
    // Validate input
    const validatedInput = procedure.contract.input.parse(input);
    
    // Execute handler
    const result = await procedure.handler(validatedInput, context);
    
    // Validate output
    const validatedOutput = procedure.contract.output.parse(result);
    
    return validatedOutput;
  } catch (error) {
    // Handle Zod validation errors
    if (error?.name === 'ZodError') {
      throw new ValidationError('Input validation failed', {
        issues: error.issues,
      });
    }
    
    // Re-throw known errors
    throw handleError(error);
  }
}
```

**2.3. Error recovery policy**

```typescript
// packages/policies/src/withErrorRecovery.ts
import type { Policy, Handler } from '@tsdev/core';
import { TsdevError } from '@tsdev/core/errors';

export interface ErrorRecoveryOptions {
  fallback?: (error: TsdevError, input: unknown) => unknown;
  logErrors?: boolean;
  transformError?: (error: TsdevError) => TsdevError;
}

export function withErrorRecovery(options: ErrorRecoveryOptions = {}): Policy {
  return <TInput, TOutput>(handler: Handler<TInput, TOutput>): Handler<TInput, TOutput> => {
    return async (input, context) => {
      try {
        return await handler(input, context);
      } catch (error) {
        const tsdevError = error instanceof TsdevError 
          ? error 
          : new ExecutionError(error.message);
        
        if (options.logErrors) {
          console.error('[ErrorRecovery]', tsdevError.toJSON());
        }
        
        if (options.transformError) {
          throw options.transformError(tsdevError);
        }
        
        if (options.fallback) {
          return options.fallback(tsdevError, input) as TOutput;
        }
        
        throw tsdevError;
      }
    };
  };
}
```

---

### 3. Безопасность (HIGH PRIORITY)

#### Проблема
- Нет аутентификации/авторизации
- Отсутствует input sanitization
- Нет rate limiting на транспортном уровне
- Отсутствует audit logging

#### Решение

**3.1. Система аутентификации**

```typescript
// packages/security/src/auth.ts

export interface User {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface AuthContext {
  user?: User;
  token?: string;
  sessionId?: string;
}

// Add auth to ExecutionContext
declare module '@tsdev/core' {
  interface ExecutionContext {
    auth?: AuthContext;
  }
}

// Auth policy
export function withAuth(options: {
  required?: boolean;
  roles?: string[];
  permissions?: string[];
}): Policy {
  return <TInput, TOutput>(handler: Handler<TInput, TOutput>): Handler<TInput, TOutput> => {
    return async (input, context) => {
      const { auth } = context;
      
      // Check if auth is required
      if (options.required && !auth?.user) {
        throw new AuthenticationError('Authentication required');
      }
      
      // Check roles
      if (options.roles && auth?.user) {
        const hasRole = options.roles.some(role => 
          auth.user?.roles.includes(role)
        );
        if (!hasRole) {
          throw new AuthorizationError('Insufficient role');
        }
      }
      
      // Check permissions
      if (options.permissions && auth?.user) {
        const hasPermission = options.permissions.every(perm =>
          auth.user?.permissions.includes(perm)
        );
        if (!hasPermission) {
          throw new AuthorizationError('Insufficient permissions');
        }
      }
      
      return handler(input, context);
    };
  };
}

// JWT verification helper
export async function verifyJWT(token: string): Promise<User> {
  // Implement JWT verification
  // This is a placeholder - use proper JWT library
  throw new Error('Not implemented');
}
```

**3.2. Input sanitization policy**

```typescript
// packages/security/src/sanitization.ts
import DOMPurify from 'isomorphic-dompurify';

export interface SanitizationOptions {
  html?: boolean;
  sql?: boolean;
  maxLength?: number;
}

export function withSanitization(options: SanitizationOptions = {}): Policy {
  return <TInput, TOutput>(handler: Handler<TInput, TOutput>): Handler<TInput, TOutput> => {
    return async (input, context) => {
      const sanitized = sanitizeInput(input, options);
      return handler(sanitized as TInput, context);
    };
  };
}

function sanitizeInput(input: unknown, options: SanitizationOptions): unknown {
  if (typeof input === 'string') {
    let result = input;
    
    // HTML sanitization
    if (options.html) {
      result = DOMPurify.sanitize(result);
    }
    
    // SQL injection prevention
    if (options.sql) {
      result = result.replace(/['";\\]/g, '');
    }
    
    // Length limit
    if (options.maxLength) {
      result = result.slice(0, options.maxLength);
    }
    
    return result;
  }
  
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item, options));
  }
  
  if (input && typeof input === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value, options);
    }
    return sanitized;
  }
  
  return input;
}
```

**3.3. Audit logging**

```typescript
// packages/security/src/audit.ts

export interface AuditEvent {
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  metadata: Record<string, unknown>;
  success: boolean;
  error?: string;
}

export interface AuditLogger {
  log(event: AuditEvent): Promise<void>;
}

export function withAuditLog(logger: AuditLogger): Policy {
  return <TInput, TOutput>(handler: Handler<TInput, TOutput>): Handler<TInput, TOutput> => {
    return async (input, context) => {
      const startTime = Date.now();
      let success = false;
      let error: string | undefined;
      
      try {
        const result = await handler(input, context);
        success = true;
        return result;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        await logger.log({
          timestamp: new Date(),
          userId: context.auth?.user?.id,
          action: 'procedure.execute',
          resource: context.metadata.procedureName as string,
          metadata: {
            requestId: context.requestId,
            executionTime: Date.now() - startTime,
            transport: context.metadata.transport,
          },
          success,
          error,
        });
      }
    };
  };
}
```

---

### 4. Производительность и масштабирование (MEDIUM PRIORITY)

#### Решение

**4.1. Кеширование**

```typescript
// packages/policies/src/withCache.ts
import type { Policy } from '@tsdev/core';

export interface CacheOptions {
  ttl?: number; // Time to live in ms
  keyFn?: (input: unknown) => string;
  storage?: CacheStorage;
}

export interface CacheStorage {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
}

// In-memory cache implementation
class MemoryCache implements CacheStorage {
  private cache = new Map<string, { value: unknown; expires: number }>();
  
  async get(key: string): Promise<unknown | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  async set(key: string, value: unknown, ttl: number): Promise<void> {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl,
    });
  }
  
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
}

export function withCache(options: CacheOptions = {}): Policy {
  const {
    ttl = 60000, // 1 minute default
    keyFn = (input) => JSON.stringify(input),
    storage = new MemoryCache(),
  } = options;
  
  return <TInput, TOutput>(handler: Handler<TInput, TOutput>): Handler<TInput, TOutput> => {
    return async (input, context) => {
      const cacheKey = keyFn(input);
      
      // Try to get from cache
      const cached = await storage.get(cacheKey);
      if (cached !== null) {
        console.log(`[Cache] HIT: ${cacheKey}`);
        return cached as TOutput;
      }
      
      console.log(`[Cache] MISS: ${cacheKey}`);
      
      // Execute handler
      const result = await handler(input, context);
      
      // Store in cache
      await storage.set(cacheKey, result, ttl);
      
      return result;
    };
  };
}
```

**4.2. Request batching**

```typescript
// packages/core/src/batching.ts

export interface BatchRequest {
  id: string;
  procedureName: string;
  input: unknown;
}

export interface BatchResponse {
  id: string;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export async function executeBatch(
  requests: BatchRequest[],
  registry: Registry,
  context: ExecutionContext
): Promise<BatchResponse[]> {
  // Execute all requests in parallel
  const results = await Promise.allSettled(
    requests.map(async (req) => {
      const procedure = registry.get(req.procedureName);
      if (!procedure) {
        throw new ProcedureNotFoundError(req.procedureName);
      }
      
      const result = await executeProcedure(procedure, req.input, context);
      return { id: req.id, result };
    })
  );
  
  return results.map((result, index) => {
    const req = requests[index];
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        id: req.id,
        error: {
          code: 'EXECUTION_ERROR',
          message: result.reason.message,
        },
      };
    }
  });
}
```

**4.3. Connection pooling для workflow**

```typescript
// packages/workflow/src/pool.ts

export class WorkflowExecutionPool {
  private activeExecutions = new Map<string, Promise<WorkflowExecutionResult>>();
  private maxConcurrent = 10;
  
  async execute(
    workflow: WorkflowDefinition,
    registry: Registry,
    input: Record<string, unknown>
  ): Promise<WorkflowExecutionResult> {
    // Wait if pool is full
    while (this.activeExecutions.size >= this.maxConcurrent) {
      await Promise.race(this.activeExecutions.values());
    }
    
    const executionId = generateExecutionId();
    const promise = executeWorkflow(workflow, registry, input);
    
    this.activeExecutions.set(executionId, promise);
    
    try {
      return await promise;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }
}
```

---

### 5. Developer Experience (MEDIUM PRIORITY)

#### Решение

**5.1. CLI инструмент для разработки**

```typescript
// packages/cli/src/commands/dev.ts

export function createDevCLI() {
  return {
    name: 'tsdev',
    commands: {
      // Generate new procedure
      generate: {
        procedure: async (name: string) => {
          const [resource, action] = name.split('.');
          
          // Generate contract file
          const contractPath = `src/contracts/${resource}.ts`;
          // Generate handler file
          const handlerPath = `src/handlers/${resource}.ts`;
          
          // Create files with templates
          console.log(`✓ Created ${contractPath}`);
          console.log(`✓ Created ${handlerPath}`);
        },
        
        // Generate adapter
        adapter: async (type: 'grpc' | 'graphql' | 'websocket') => {
          console.log(`Generating ${type} adapter...`);
        },
      },
      
      // Validate contracts
      validate: async () => {
        const registry = await collectRegistry();
        const errors: string[] = [];
        
        for (const [name, proc] of registry) {
          // Check naming conventions
          if (!name.includes('.')) {
            errors.push(`${name}: should follow 'resource.action' convention`);
          }
          
          // Validate schemas
          try {
            proc.contract.input.parse({});
          } catch (e) {
            // Schema is valid
          }
        }
        
        if (errors.length > 0) {
          console.error('Validation errors:', errors);
          process.exit(1);
        }
        
        console.log('✓ All contracts valid');
      },
      
      // Introspection
      list: async () => {
        const registry = await collectRegistry();
        console.log('Registered procedures:');
        for (const [name, proc] of registry) {
          console.log(`  - ${name}: ${proc.contract.description || 'No description'}`);
        }
      },
    },
  };
}
```

**5.2. VSCode extension stub**

```typescript
// packages/vscode/src/extension.ts

export function activate(context: vscode.ExtensionContext) {
  // Auto-complete для procedure names
  const procedureCompletion = vscode.languages.registerCompletionItemProvider(
    'typescript',
    {
      async provideCompletionItems(document, position) {
        // Scan registry and provide completions
        const registry = await collectRegistry();
        return Array.from(registry.keys()).map(name => {
          const item = new vscode.CompletionItem(name);
          item.kind = vscode.CompletionItemKind.Function;
          return item;
        });
      },
    }
  );
  
  context.subscriptions.push(procedureCompletion);
  
  // Hover information
  const hoverProvider = vscode.languages.registerHoverProvider('typescript', {
    async provideHover(document, position) {
      // Show contract info on hover
    },
  });
  
  context.subscriptions.push(hoverProvider);
}
```

**5.3. Schema visualization**

```typescript
// packages/devtools/src/schema-viewer.ts

export function generateSchemaHTML(contract: Contract): string {
  // Convert Zod schema to visual representation
  return `
    <div class="schema">
      <h3>${contract.name}</h3>
      <div class="input">
        <h4>Input</h4>
        ${zodSchemaToHTML(contract.input)}
      </div>
      <div class="output">
        <h4>Output</h4>
        ${zodSchemaToHTML(contract.output)}
      </div>
    </div>
  `;
}
```

---

### 6. Дополнительные адаптеры (LOW-MEDIUM PRIORITY)

#### Решение

**6.1. GraphQL адаптер**

```typescript
// packages/adapters/src/graphql.ts
import { GraphQLSchema, GraphQLObjectType } from 'graphql';

export function createGraphQLSchema(registry: Registry): GraphQLSchema {
  // Convert procedures to GraphQL queries/mutations
  const queryFields = {};
  const mutationFields = {};
  
  for (const [name, procedure] of registry) {
    const [resource, action] = name.split('.');
    
    // Read operations -> queries
    if (['get', 'list', 'search'].includes(action)) {
      queryFields[name] = createGraphQLField(procedure);
    } else {
      // Write operations -> mutations
      mutationFields[name] = createGraphQLField(procedure);
    }
  }
  
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: queryFields,
    }),
    mutation: new GraphQLObjectType({
      name: 'Mutation',
      fields: mutationFields,
    }),
  });
}
```

**6.2. gRPC адаптер**

```typescript
// packages/adapters/src/grpc.ts

export function createGRPCService(registry: Registry) {
  // Generate .proto file from contracts
  const protoContent = generateProtoFile(registry);
  
  // Create gRPC server
  const server = new grpc.Server();
  
  // Add services
  for (const [name, procedure] of registry) {
    server.addService(/* ... */);
  }
  
  return server;
}
```

**6.3. WebSocket адаптер**

```typescript
// packages/adapters/src/websocket.ts
import { WebSocketServer } from 'ws';

export function createWebSocketServer(registry: Registry, port: number) {
  const wss = new WebSocketServer({ port });
  
  wss.on('connection', (ws) => {
    ws.on('message', async (data) => {
      const { id, procedure, input } = JSON.parse(data.toString());
      
      try {
        const proc = registry.get(procedure);
        if (!proc) {
          throw new ProcedureNotFoundError(procedure);
        }
        
        const context = createExecutionContext({
          transport: 'websocket',
        });
        
        const result = await executeProcedure(proc, input, context);
        
        ws.send(JSON.stringify({ id, result }));
      } catch (error) {
        ws.send(JSON.stringify({
          id,
          error: error.message,
        }));
      }
    });
  });
  
  return wss;
}
```

---

### 7. SDK Generation (MEDIUM PRIORITY)

#### Решение

```typescript
// packages/generators/src/sdk.ts

export function generateTypeScriptSDK(
  registry: Registry,
  options: { packageName: string }
): string {
  const procedures = Array.from(registry.entries());
  
  return `
// Generated TypeScript SDK
import { z } from 'zod';

export class ${options.packageName}Client {
  constructor(private baseUrl: string) {}
  
  ${procedures.map(([name, proc]) => `
  async ${name.replace('.', '_')}(
    input: z.infer<typeof ${name}InputSchema>
  ): Promise<z.infer<typeof ${name}OutputSchema>> {
    const response = await fetch(\`\${this.baseUrl}/rpc/${name}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    
    return response.json();
  }
  `).join('\n')}
}

// Export schemas
${procedures.map(([name, proc]) => `
export const ${name}InputSchema = ${zodToString(proc.contract.input)};
export const ${name}OutputSchema = ${zodToString(proc.contract.output)};
`).join('\n')}
  `;
}

export function generatePythonSDK(registry: Registry): string {
  // Generate Python SDK using dataclasses and requests
  return `
import requests
from dataclasses import dataclass
from typing import Any

class TsdevClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
    
    def call_procedure(self, name: str, input: dict) -> dict:
        response = requests.post(
            f"{self.base_url}/rpc/{name}",
            json=input
        )
        response.raise_for_status()
        return response.json()
  `;
}
```

---

### 8. Contract Versioning (MEDIUM PRIORITY)

#### Решение

```typescript
// packages/core/src/versioning.ts

export interface VersionedContract extends Contract {
  version: string;
  deprecated?: boolean;
  deprecationMessage?: string;
  replacedBy?: string;
}

export interface ContractMigration {
  from: string;
  to: string;
  migrateInput: (input: unknown) => unknown;
  migrateOutput: (output: unknown) => unknown;
}

export class VersionedRegistry {
  private contracts = new Map<string, Map<string, VersionedContract>>();
  private migrations = new Map<string, ContractMigration[]>();
  
  register(contract: VersionedContract) {
    const versions = this.contracts.get(contract.name) || new Map();
    versions.set(contract.version, contract);
    this.contracts.set(contract.name, versions);
  }
  
  get(name: string, version?: string): VersionedContract | undefined {
    const versions = this.contracts.get(name);
    if (!versions) return undefined;
    
    if (version) {
      return versions.get(version);
    }
    
    // Return latest version
    return Array.from(versions.values())
      .sort((a, b) => b.version.localeCompare(a.version))[0];
  }
  
  addMigration(migration: ContractMigration) {
    const migrations = this.migrations.get(migration.from) || [];
    migrations.push(migration);
    this.migrations.set(migration.from, migrations);
  }
}
```

---

## 📋 План внедрения (Roadmap)

### Phase 1: Фундамент (1-2 недели)
1. ✅ Настроить тестовую инфраструктуру
2. ✅ Создать систему typed errors
3. ✅ Добавить базовую аутентификацию/авторизацию
4. ✅ Написать тесты для core и workflow пакетов

### Phase 2: Безопасность и производительность (1-2 недели)
1. ✅ Реализовать audit logging
2. ✅ Добавить caching policy
3. ✅ Имплементировать input sanitization
4. ✅ Добавить request batching

### Phase 3: Developer Experience (1 неделя)
1. ✅ Создать CLI инструмент для генерации
2. ✅ Добавить validation команды
3. ✅ Улучшить error messages
4. ✅ Создать dev-mode с hot reload

### Phase 4: Расширения (2-3 недели)
1. ✅ GraphQL адаптер
2. ✅ gRPC адаптер
3. ✅ WebSocket адаптер
4. ✅ SDK generation (TypeScript, Python)

### Phase 5: Production-ready (1-2 недели)
1. ✅ Contract versioning
2. ✅ Distributed tracing improvements
3. ✅ Health checks и metrics
4. ✅ Production documentation

---

## 🎯 Метрики успеха

После внедрения улучшений:

- **Тестовое покрытие**: ≥80% для всех пакетов
- **Type safety**: 100% TypeScript strict mode
- **Security**: Все OWASP Top 10 покрыты
- **Performance**: <100ms latency для простых процедур
- **DX**: Время создания новой процедуры <5 минут
- **Documentation**: 100% API coverage
- **Production readiness**: Zero downtime deployments

---

## 🔧 Технические детали

### Зависимости для новых пакетов

```json
{
  "@tsdev/testing": {
    "dependencies": ["vitest", "@vitest/coverage-v8"]
  },
  "@tsdev/security": {
    "dependencies": [
      "jsonwebtoken",
      "bcrypt",
      "isomorphic-dompurify",
      "helmet"
    ]
  },
  "@tsdev/cli": {
    "dependencies": [
      "commander",
      "chalk",
      "inquirer"
    ]
  }
}
```

### Конфигурация для production

```typescript
// config/production.ts
export const productionConfig = {
  // Отключить output validation для производительности
  disableOutputValidation: true,
  
  // Включить кеширование
  enableCaching: true,
  cacheGTL: 60000,
  
  // Rate limiting
  rateLimit: {
    maxTokens: 100,
    refillRate: 10,
  },
  
  // Tracing sampling
  tracingSampleRate: 0.1, // 10%
  
  // Security
  auth: {
    required: true,
    jwtSecret: process.env.JWT_SECRET,
  },
};
```

---

## 📚 Дополнительные рекомендации

### 1. Мониторинг и алерты
- Настроить Prometheus metrics export
- Добавить Grafana dashboards
- Настроить alerting для критических ошибок

### 2. Документация
- Создать interactive playground (Swagger-like)
- Добавить больше примеров использования
- Создать migration guides

### 3. Экосистема
- Создать marketplace для плагинов
- Добавить community templates
- Организовать showcase проектов

### 4. CI/CD
- Автоматические тесты на каждый PR
- Semantic versioning для релизов
- Automated changelog generation

---

## Заключение

Предложенные улучшения превратят tsdev из proof-of-concept в production-ready фреймворк корпоративного уровня, сохраняя при этом его философию contracts-first и zero-boilerplate подхода.

**Главные приоритеты:**
1. **Тестирование** - критично для надежности
2. **Безопасность** - обязательно для production
3. **Error handling** - улучшит debugging experience
4. **Developer tools** - ускорит разработку

Реализация займет примерно **6-8 недель** при работе одного разработчика, или **3-4 недели** при команде из 2-3 человек.
