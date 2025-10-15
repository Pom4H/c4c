# tsdev Architecture

This document explains how tsdev is implemented internally.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Transport Layer                       │
│  (HTTP, CLI, WebSocket, gRPC, Message Queue, etc.)      │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│                    Adapter Layer                         │
│        (@tsdev/adapters - thin translation)             │
│  • Parse transport-specific input                        │
│  • Create ExecutionContext                               │
│  • Call executeProcedure()                               │
│  • Format output                                         │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│                      Core Layer                          │
│              (@tsdev/core - framework)                   │
│  • Contract validation (Zod)                             │
│  • Procedure execution                                   │
│  • Policy composition                                    │
│  • Registry management                                   │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│                   Business Logic                         │
│               (your handlers/)                           │
│  • Pure functions: input → output                        │
│  • No transport awareness                                │
│  • Fully testable in isolation                           │
└─────────────────────────────────────────────────────────┘
```

---

## Core Types

### Contract

The foundation of everything:

```typescript
interface Contract<TInput = unknown, TOutput = unknown> {
  name: string;              // e.g., "users.create"
  description?: string;
  input: z.ZodType<TInput>;  // Zod schema
  output: z.ZodType<TOutput>;
  metadata?: Record<string, unknown>;  // Arbitrary metadata
}
```

**What it enables:**
- Runtime validation: `contract.input.parse(data)`
- Type inference: `z.infer<typeof contract.input>`
- OpenAPI generation: `zodToJsonSchema(contract.input)`
- Documentation: `contract.description`
- Introspection: `contract.metadata`

### Handler

Business logic function:

```typescript
type Handler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: ExecutionContext
) => Promise<TOutput> | TOutput;
```

**Characteristics:**
- Pure function (given input, return output)
- Receives validated input
- Returns unvalidated output (validated by framework)
- Transport-agnostic

### Procedure

Contract + Handler:

```typescript
interface Procedure<TInput = unknown, TOutput = unknown> {
  contract: Contract<TInput, TOutput>;
  handler: Handler<TInput, TOutput>;
}
```

**This is what you export from handlers/:**

```typescript
export const createUser: Procedure = {
  contract: createUserContract,
  handler: async (input, context) => {
    // Business logic
  }
};
```

### Registry

Map of procedures:

```typescript
type Registry = Map<string, Procedure>;
```

**Created via auto-discovery:**

```typescript
const registry = await collectRegistry("./handlers");
// Key: contract.name (e.g., "users.create")
// Value: Procedure object
```

### Policy

Function that wraps handlers:

```typescript
type Policy = <TInput, TOutput>(
  handler: Handler<TInput, TOutput>
) => Handler<TInput, TOutput>;
```

**Example:**

```typescript
const withRetry: Policy = (handler) => {
  return async (input, context) => {
    for (let i = 0; i < 3; i++) {
      try {
        return await handler(input, context);
      } catch (error) {
        if (i === 2) throw error;
      }
    }
  };
};
```

---

## Core Mechanisms

### 1. Auto-Discovery (collectRegistry)

**Location:** `packages/core/src/registry.ts`

**How it works:**

```typescript
export async function collectRegistry(handlersPath = "src/handlers"): Promise<Registry> {
  const registry: Registry = new Map();

  // 1. Find all TypeScript files
  const handlerFiles = globSync(`${handlersPath}/**/*.ts`, {
    absolute: true,
    ignore: ["**/*.test.ts", "**/*.spec.ts"],
  });

  for (const file of handlerFiles) {
    // 2. Dynamic import
    const module = await import(file);

    // 3. Check each export
    for (const [exportName, exportValue] of Object.entries(module)) {
      if (isProcedure(exportValue)) {
        const procedureName = exportValue.contract.name || exportName;
        registry.set(procedureName, exportValue as Procedure);
      }
    }
  }

  return registry;
}

function isProcedure(value: unknown): value is Procedure {
  return (
    typeof value === "object" &&
    value !== null &&
    "contract" in value &&
    "handler" in value &&
    typeof (value as any).handler === "function"
  );
}
```

**Key points:**
- Uses `globSync` to find files
- Dynamic `import()` for each file
- Runtime type checking to identify Procedures
- No decorators, no manual registration

### 2. Execution Flow (executeProcedure)

**Location:** `packages/core/src/executor.ts`

**How it works:**

```typescript
export async function executeProcedure<TInput, TOutput>(
  procedure: Procedure<TInput, TOutput>,
  input: unknown,
  context: ExecutionContext
): Promise<TOutput> {
  // 1. Validate input against contract
  const validatedInput = procedure.contract.input.parse(input);

  // 2. Execute handler (with validated input)
  const result = await procedure.handler(validatedInput, context);

  // 3. Validate output against contract
  const validatedOutput = procedure.contract.output.parse(result);

  return validatedOutput;
}
```

**Validation guarantees:**
- Input is validated before handler runs
- Output is validated before returning
- Type safety at runtime AND compile-time
- Throws `ZodError` if validation fails

### 3. Policy Composition (applyPolicies)

**Location:** `packages/core/src/executor.ts`

**How it works:**

```typescript
export function applyPolicies<TInput, TOutput>(
  handler: Handler<TInput, TOutput>,
  ...policies: Policy[]
): Handler<TInput, TOutput> {
  return policies.reduce((h, policy) => policy(h), handler);
}
```

**Execution order (right to left):**

```typescript
const handler = applyPolicies(
  baseHandler,
  withLogging,    // 3. Outer wrapper
  withSpan,       // 2. Middle wrapper
  withRetry       // 1. Inner wrapper (executes first)
);
```

**Equivalent to:**

```typescript
withLogging(withSpan(withRetry(baseHandler)))
```

**Call stack:**

```
withLogging → start
  withSpan → start
    withRetry → start
      baseHandler → execute
    withRetry → end
  withSpan → end
withLogging → end
```

---

## Adapters in Detail

Adapters translate transport → core.

### HTTP Adapter

**Location:** `packages/adapters/src/http.ts`

**RPC Endpoint:**

```typescript
// POST /rpc/:procedureName
if (req.method === "POST" && req.url?.startsWith("/rpc/")) {
  const procedureName = req.url.slice(5);
  
  // 1. Parse JSON body
  const body = await parseBody(req);
  const input = JSON.parse(body);
  
  // 2. Get procedure
  const procedure = registry.get(procedureName);
  if (!procedure) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Procedure not found" }));
    return;
  }
  
  // 3. Create execution context
  const context = createExecutionContext({
    transport: "http",
    method: req.method,
    url: req.url,
    userAgent: req.headers["user-agent"],
  });
  
  // 4. Execute procedure
  const result = await executeProcedure(procedure, input, context);
  
  // 5. Return JSON response
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}
```

**Key points:**
- Thin translation layer
- No business logic
- Calls `executeProcedure()` from core

### REST Adapter

**Location:** `packages/adapters/src/rest.ts`

**Convention-based routing:**

```typescript
function matchProcedure(
  procedureName: string,
  urlParts: string[],
  method: string
): Record<string, string> | null {
  const [resource, action] = procedureName.split(".");
  
  switch (action) {
    case "create":
      // POST /resource
      if (method === "POST" && urlParts.length === 1 && urlParts[0] === resource) {
        return {};
      }
      break;
      
    case "list":
      // GET /resource
      if (method === "GET" && urlParts.length === 1 && urlParts[0] === resource) {
        return {};
      }
      break;
      
    case "get":
      // GET /resource/:id
      if (method === "GET" && urlParts.length === 2 && urlParts[0] === resource) {
        return { id: urlParts[1] };
      }
      break;
      
    case "update":
      // PUT /resource/:id
      if (method === "PUT" && urlParts.length === 2 && urlParts[0] === resource) {
        return { id: urlParts[1] };
      }
      break;
      
    case "delete":
      // DELETE /resource/:id
      if (method === "DELETE" && urlParts.length === 2 && urlParts[0] === resource) {
        return { id: urlParts[1] };
      }
      break;
  }
  
  return null;
}
```

**Mapping table:**

| Procedure Name | HTTP Method | REST Path |
|---------------|-------------|-----------|
| `users.create` | `POST` | `/users` |
| `users.list` | `GET` | `/users` |
| `users.get` | `GET` | `/users/:id` |
| `users.update` | `PUT` | `/users/:id` |
| `users.delete` | `DELETE` | `/users/:id` |

**Input building:**

```typescript
// Merge params, query, and body
const input = {
  ...match.params,      // { id: "123" }
  ...match.query,       // { limit: "10" }
  ...bodyData           // { name: "Alice" }
};
```

### CLI Adapter

**Location:** `packages/adapters/src/cli.ts`

**Argument parsing:**

```typescript
function parseCliArgs(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      
      // --key=value format
      if (key.includes("=")) {
        const [k, ...valueParts] = key.split("=");
        input[k] = parseValue(valueParts.join("="));
      }
      // --key value format
      else {
        const value = args[i + 1];
        if (value && !value.startsWith("--")) {
          input[key] = parseValue(value);
          i++;
        } else {
          input[key] = true;  // Boolean flag
        }
      }
    }
  }
  
  return input;
}

function parseValue(value: string): unknown {
  // Try number
  if (!isNaN(Number(value))) {
    return Number(value);
  }
  
  // Try boolean
  if (value === "true") return true;
  if (value === "false") return false;
  
  // Try JSON
  if (value.startsWith("{") || value.startsWith("[")) {
    try {
      return JSON.parse(value);
    } catch {}
  }
  
  return value;
}
```

**Usage:**

```bash
tsdev users.create --name Alice --email alice@example.com
# Parsed as: { name: "Alice", email: "alice@example.com" }

tsdev math.add --a 5 --b 3
# Parsed as: { a: 5, b: 3 }

tsdev users.create --json '{"name":"Alice","email":"alice@example.com"}'
# Parsed as: { name: "Alice", email: "alice@example.com" }
```

---

## Workflow System

### Workflow Runtime

**Location:** `packages/workflow/src/runtime.ts`

**Core execution:**

```typescript
export async function executeWorkflow(
  workflow: WorkflowDefinition,
  registry: Registry,
  initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
  // Create workflow-level OpenTelemetry span
  return tracer.startActiveSpan("workflow.execute", async (workflowSpan) => {
    const context: WorkflowContext = {
      workflowId: workflow.id,
      executionId: generateExecutionId(),
      variables: { ...workflow.variables, ...initialInput },
      nodeOutputs: new Map(),
      startTime: new Date(),
    };
    
    let currentNodeId = workflow.startNode;
    const nodesExecuted: string[] = [];
    
    // Execute nodes sequentially
    while (currentNodeId) {
      const node = workflow.nodes.find(n => n.id === currentNodeId);
      if (!node) throw new Error(`Node ${currentNodeId} not found`);
      
      nodesExecuted.push(currentNodeId);
      
      // Execute node (creates its own span)
      const nextNodeId = await executeNode(node, context, registry, workflow);
      
      currentNodeId = nextNodeId;
    }
    
    // Return results
    return {
      executionId: context.executionId,
      status: "completed",
      outputs: Object.fromEntries(context.nodeOutputs),
      executionTime: Date.now() - context.startTime.getTime(),
      nodesExecuted,
    };
  });
}
```

### Node Types

**Procedure Node:**

```typescript
async function executeProcedureNode(
  node: WorkflowNode,
  context: WorkflowContext,
  registry: Registry
): Promise<string | undefined> {
  // Get procedure
  const procedure = registry.get(node.procedureName);
  
  // Build input from node config + context variables
  const input = {
    ...node.config,
    ...context.variables
  };
  
  // Execute procedure
  const execContext = createExecutionContext({
    transport: "workflow",
    workflowId: context.workflowId,
    executionId: context.executionId,
    nodeId: node.id,
  });
  
  const output = await executeProcedure(procedure, input, execContext);
  
  // Store output
  context.nodeOutputs.set(node.id, output);
  
  // Merge output into variables (for next nodes)
  Object.assign(context.variables, output);
  
  // Return next node
  return node.next;
}
```

**Condition Node:**

```typescript
async function executeConditionNode(
  node: WorkflowNode,
  context: WorkflowContext
): Promise<string | undefined> {
  const config = node.config as ConditionConfig;
  
  // Evaluate JavaScript expression with context variables
  const result = evaluateExpression(config.expression, context.variables);
  
  // Return appropriate branch
  return result ? config.trueBranch : config.falseBranch;
}

function evaluateExpression(expression: string, variables: Record<string, unknown>): boolean {
  // Create function with variables as parameters
  const func = new Function(...Object.keys(variables), `return ${expression}`);
  return func(...Object.values(variables));
}
```

**Parallel Node:**

```typescript
async function executeParallelNode(
  node: WorkflowNode,
  context: WorkflowContext,
  registry: Registry,
  workflow: WorkflowDefinition
): Promise<string | undefined> {
  const config = node.config as ParallelConfig;
  
  // Execute all branches in parallel
  const branchPromises = config.branches.map(async (branchNodeId) => {
    const branchNode = workflow.nodes.find(n => n.id === branchNodeId);
    return executeNode(branchNode, context, registry, workflow);
  });
  
  if (config.waitForAll) {
    await Promise.all(branchPromises);
  } else {
    await Promise.race(branchPromises);
  }
  
  return node.next;
}
```

### OpenTelemetry Integration

**Span hierarchy:**

```
workflow.execute (parent span)
├── workflow.node.procedure (node: create-user)
│   └── procedure.users.create (from withSpan policy)
│       └── withRetry (from withRetry policy)
├── workflow.node.condition (node: check-premium)
└── workflow.node.procedure (node: send-email)
    └── procedure.emails.send
```

**Attributes added:**

```typescript
workflowSpan.setAttributes({
  "workflow.id": workflow.id,
  "workflow.name": workflow.name,
  "workflow.version": workflow.version,
  "workflow.execution_id": executionId,
  "workflow.start_node": workflow.startNode,
  "workflow.node_count": workflow.nodes.length,
  "workflow.status": "completed",
  "workflow.execution_time_ms": executionTime,
});

nodeSpan.setAttributes({
  "workflow.id": workflow.id,
  "workflow.execution_id": executionId,
  "node.id": node.id,
  "node.type": node.type,
  "node.procedure": node.procedureName,
  "node.status": "completed",
});
```

---

## OpenAPI Generation

**Location:** `packages/generators/src/openapi.ts`

**How it works:**

```typescript
export function generateOpenAPISpec(registry: Registry): OpenAPISpec {
  const spec: OpenAPISpec = {
    openapi: "3.0.0",
    info: { title: "tsdev API", version: "1.0.0" },
    paths: {},
  };
  
  for (const [name, procedure] of registry.entries()) {
    // Convert Zod schemas to JSON Schema
    const inputSchema = zodToJsonSchema(procedure.contract.input);
    const outputSchema = zodToJsonSchema(procedure.contract.output);
    
    // RPC endpoint
    spec.paths[`/rpc/${name}`] = {
      post: {
        operationId: name,
        summary: procedure.contract.description,
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: inputSchema }
          }
        },
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": { schema: outputSchema }
            }
          }
        }
      }
    };
    
    // REST endpoint (if applicable)
    const restPath = generateRESTPath(procedure.contract);
    if (restPath) {
      Object.assign(spec.paths, restPath);
    }
  }
  
  return spec;
}
```

**Key dependencies:**
- `zod-to-json-schema`: Converts Zod schemas to JSON Schema
- Runs at runtime (can be saved to file)

---

## Policy Implementation

### withRetry

**Location:** `packages/policies/src/withRetry.ts`

```typescript
export function withRetry(options: RetryOptions = {}): Policy {
  const { maxAttempts = 3, delayMs = 100, backoffMultiplier = 2 } = options;
  
  return (handler) => {
    return async (input, context) => {
      let lastError: Error | undefined;
      let currentDelay = delayMs;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await handler(input, context);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          if (attempt === maxAttempts) break;
          
          await sleep(currentDelay);
          currentDelay *= backoffMultiplier;  // Exponential backoff
        }
      }
      
      throw lastError;
    };
  };
}
```

### withLogging

**Location:** `packages/policies/src/withLogging.ts`

```typescript
export function withLogging(procedureName: string): Policy {
  return (handler) => {
    return async (input, context) => {
      console.log(`[${procedureName}] Starting execution`, {
        requestId: context.requestId,
        timestamp: context.timestamp.toISOString(),
      });
      
      const startTime = performance.now();
      
      try {
        const result = await handler(input, context);
        const duration = performance.now() - startTime;
        
        console.log(`[${procedureName}] Completed successfully`, {
          requestId: context.requestId,
          durationMs: duration.toFixed(2),
        });
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        console.error(`[${procedureName}] Failed with error`, {
          requestId: context.requestId,
          durationMs: duration.toFixed(2),
          error: error instanceof Error ? error.message : String(error),
        });
        
        throw error;
      }
    };
  };
}
```

### withSpan

**Location:** `packages/policies/src/withSpan.ts`

```typescript
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("tsdev.procedures");

export function withSpan(procedureName: string): Policy {
  return (handler) => {
    return async (input, context) => {
      // Create OpenTelemetry span
      return tracer.startActiveSpan(procedureName, async (span) => {
        try {
          // Add attributes
          span.setAttributes({
            "procedure.name": procedureName,
            "request.id": context.requestId,
            "input": JSON.stringify(input),
          });
          
          // Execute handler
          const result = await handler(input, context);
          
          // Add output attributes
          span.setAttributes({
            "output": JSON.stringify(result),
          });
          
          span.setStatus({ code: SpanStatusCode.OK });
          
          return result;
        } catch (error) {
          // Record exception
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          span.setStatus({ code: SpanStatusCode.ERROR });
          
          throw error;
        } finally {
          span.end();
        }
      });
    };
  };
}
```

---

## Package Structure

### Monorepo Setup

Uses pnpm workspaces:

```json
// pnpm-workspace.yaml
packages:
  - "packages/*"
  - "examples/*"
```

### Package Dependencies

```
@tsdev/core (base)
  ↓ depends on
  └── zod

@tsdev/workflow
  ↓ depends on
  ├── @tsdev/core
  └── @opentelemetry/api

@tsdev/adapters
  ↓ depends on
  ├── @tsdev/core
  ├── @tsdev/workflow
  └── @tsdev/generators

@tsdev/policies
  ↓ depends on
  ├── @tsdev/core
  └── @opentelemetry/api

@tsdev/generators
  ↓ depends on
  ├── @tsdev/core
  └── zod-to-json-schema
```

### Build Order

```bash
# 1. Build core first (no deps)
cd packages/core && pnpm build

# 2. Build workflow and policies (depend on core)
cd packages/workflow && pnpm build
cd packages/policies && pnpm build

# 3. Build generators (depends on core)
cd packages/generators && pnpm build

# 4. Build adapters (depends on core, workflow, generators)
cd packages/adapters && pnpm build
```

---

## Performance Characteristics

### Registry Collection

**Happens once at startup:**

```typescript
const registry = await collectRegistry("./handlers");
```

**Cost:**
- File system scan: O(n) where n = number of files
- Dynamic imports: One per file
- Type checking: One per export

**Typical startup time:** < 100ms for 100 procedures

### Procedure Execution

**Per request:**

1. Input validation (Zod): ~0.1-1ms
2. Handler execution: Depends on business logic
3. Output validation (Zod): ~0.1-1ms
4. Policy overhead: ~0.01ms per policy

**Total framework overhead:** < 2ms

### Policy Composition

**Applied at startup:**

```typescript
const handler = applyPolicies(baseHandler, ...policies);
```

**Runtime cost:** Just function calls (negligible)

### OpenTelemetry

**Span creation:** ~10μs per span  
**Attribute setting:** ~1μs per attribute

**Negligible overhead in production** (sampled traces)

---

## Extension Points

### Adding a New Transport

Create an adapter:

```typescript
import { createExecutionContext, executeProcedure, type Registry } from '@tsdev/core';

export function createWebSocketServer(registry: Registry) {
  const wss = new WebSocketServer({ port: 8080 });
  
  wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
      const { procedure, input } = JSON.parse(message);
      
      const proc = registry.get(procedure);
      if (!proc) {
        ws.send(JSON.stringify({ error: "Procedure not found" }));
        return;
      }
      
      const context = createExecutionContext({
        transport: "websocket",
        connectionId: generateConnectionId(),
      });
      
      try {
        const result = await executeProcedure(proc, input, context);
        ws.send(JSON.stringify({ result }));
      } catch (error) {
        ws.send(JSON.stringify({ error: error.message }));
      }
    });
  });
}
```

### Adding a New Policy

```typescript
export function withCache(ttl: number): Policy {
  const cache = new Map();
  
  return (handler) => {
    return async (input, context) => {
      const key = JSON.stringify(input);
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = await handler(input, context);
      cache.set(key, result);
      
      setTimeout(() => cache.delete(key), ttl);
      
      return result;
    };
  };
}
```

### Adding Workflow Node Types

```typescript
// In executeNode()
switch (node.type) {
  case "procedure":
    return executeProcedureNode(node, context, registry);
  case "condition":
    return executeConditionNode(node, context);
  case "parallel":
    return executeParallelNode(node, context, registry, workflow);
  case "custom-type":  // Your custom type
    return executeCustomNode(node, context);
}
```

---

## Testing Strategy

### Unit Testing Handlers

```typescript
import { createExecutionContext } from '@tsdev/core';
import { createUser } from './handlers/users';

test('createUser creates a user', async () => {
  const input = { name: "Alice", email: "alice@example.com" };
  const context = createExecutionContext();
  
  const result = await createUser.handler(input, context);
  
  expect(result).toMatchObject({
    id: expect.any(String),
    name: "Alice",
    email: "alice@example.com",
  });
});
```

### Integration Testing Adapters

```typescript
import { collectRegistry } from '@tsdev/core';
import { createHttpServer } from '@tsdev/adapters';

test('HTTP server executes procedures', async () => {
  const registry = await collectRegistry("./handlers");
  const server = createHttpServer(registry, 3001);
  
  const response = await fetch("http://localhost:3001/rpc/users.create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", email: "test@example.com" }),
  });
  
  expect(response.ok).toBe(true);
  
  const result = await response.json();
  expect(result).toHaveProperty("id");
  
  server.close();
});
```

### Testing Workflows

```typescript
import { executeWorkflow } from '@tsdev/workflow';

test('workflow executes all nodes', async () => {
  const workflow = { /* ... */ };
  const registry = await collectRegistry("./handlers");
  
  const result = await executeWorkflow(workflow, registry);
  
  expect(result.status).toBe("completed");
  expect(result.nodesExecuted).toEqual(["node1", "node2", "node3"]);
});
```

---

## Future Architecture Enhancements

### 1. SDK Generation

```typescript
// Generate TypeScript SDK
generateSDK(registry, {
  language: "typescript",
  output: "./sdk/client.ts"
});

// Usage
import { TsdevClient } from "./sdk/client";

const client = new TsdevClient("http://localhost:3000");
const user = await client.users.create({ name: "Alice", email: "alice@example.com" });
```

### 2. Contract Versioning

```typescript
const createUserContractV2 = {
  name: "users.create",
  version: "2.0.0",
  input: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string().optional(),  // New field
  }),
  // ...
};

// Registry supports multiple versions
registry.set("users.create@1.0.0", procedureV1);
registry.set("users.create@2.0.0", procedureV2);
```

### 3. Distributed Workflow Execution

```typescript
// Execute workflow nodes across multiple machines
executeWorkflow(workflow, registry, {
  executor: "distributed",
  workers: ["worker1:8080", "worker2:8080"],
});
```

### 4. gRPC Adapter

```typescript
createGrpcServer(registry, {
  port: 50051,
  // Auto-generate protobuf from Zod schemas
});
```

---

## Conclusion

tsdev architecture is built on:

1. **Separation of concerns**
   - Core: Framework logic
   - Adapters: Transport translation
   - Handlers: Business logic

2. **Auto-discovery via reflection**
   - No manual registration
   - Runtime introspection

3. **Convention-driven automation**
   - Naming → REST routes
   - File structure → registry

4. **Function composition**
   - Policies as pure functions
   - No framework magic

5. **Built-in observability**
   - OpenTelemetry everywhere
   - Business-level spans

**Result:** Simple, extensible, observable system with minimal boilerplate.

---

See [PHILOSOPHY.md](./PHILOSOPHY.md) for design principles.
