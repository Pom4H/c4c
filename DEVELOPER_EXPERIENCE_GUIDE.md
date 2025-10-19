# Developer Experience Guide: Типовой проект на tsdev PaaS

> **Как выглядит день разработчика на платформе tsdev** — от создания проекта до продакшена

---

## 📋 Table of Contents

1. [Quick Start: 0 → Production за 5 минут](#quick-start)
2. [Структура проекта](#project-structure)
3. [Local Development](#local-development)
4. [Writing Procedures](#writing-procedures)
5. [Creating Workflows](#creating-workflows)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Platform Services](#platform-services)
9. [Monitoring & Debugging](#monitoring)
10. [Team Collaboration](#collaboration)

---

## Quick Start: 0 → Production за 5 минут

### Шаг 1: Создание проекта (30 секунд)

```bash
# Создать новый проект
npx create-tsdev-app my-backend-api
# или
tsdev init my-backend-api

cd my-backend-api

# Выбор template:
# 1. blank           - Пустой проект
# 2. rest-api        - REST API (CRUD примеры)
# 3. workflow-engine - Workflow-heavy app (AI agents, automation)
# 4. microservice    - Микросервис с integrations
# 5. fullstack       - Backend + Next.js frontend

# Допустим выбираем "rest-api"
```

**Сгенерированная структура:**

```
my-backend-api/
├── src/
│   ├── contracts/           # Contract definitions (Zod schemas)
│   │   └── users.ts
│   ├── handlers/            # Procedure implementations
│   │   └── users.ts
│   ├── workflows/           # Workflow definitions
│   │   └── user-onboarding.ts
│   └── lib/                 # Shared utilities
│       └── db.ts
├── tests/
│   ├── procedures/
│   └── workflows/
├── .env.example             # Environment variables template
├── .env.local               # Local dev environment (gitignored)
├── tsdev.config.ts          # Platform configuration
├── package.json
├── tsconfig.json
└── README.md
```

### Шаг 2: Запуск локально (10 секунд)

```bash
# Установка зависимостей
pnpm install

# Запуск dev server с hot reload
tsdev dev

# 🚀 HTTP server listening on http://localhost:3000
# 📚 Documentation:
#    Procedures:       http://localhost:3000/procedures
#    Swagger UI:       http://localhost:3000/docs
#    Workflow UI:      http://localhost:3100
#
# 🔧 Endpoints:
#    RPC:  POST http://localhost:3000/rpc/:procedureName
#    REST: http://localhost:3000/:resource
```

### Шаг 3: Деплой на платформу (2 минуты)

```bash
# Залогиниться на платформу
tsdev login

# Создать проект (one-time)
tsdev projects:create my-backend-api

# Link local directory
tsdev link

# Создать production database
tsdev db:create postgres --name main-db

# Deploy!
git add .
git commit -m "Initial commit"
git push origin main

# 🚀 Deploying...
# ✅ Build completed (42s)
# ✅ Tests passed
# ✅ Deployed to https://my-backend-api.tsdev.run
# ✅ Custom domain: https://api.myapp.com
```

**🎉 Production готов!**

---

## Project Structure

### Полная структура production-ready проекта

```
my-backend-api/
├── src/
│   ├── contracts/                    # API contracts (Zod schemas)
│   │   ├── index.ts                  # Re-export all contracts
│   │   ├── users.ts
│   │   ├── posts.ts
│   │   ├── payments.ts
│   │   └── integrations/
│   │       ├── stripe.ts
│   │       └── sendgrid.ts
│   │
│   ├── handlers/                     # Business logic
│   │   ├── users/
│   │   │   ├── create.ts
│   │   │   ├── get.ts
│   │   │   ├── update.ts
│   │   │   └── delete.ts
│   │   ├── posts/
│   │   │   ├── create.ts
│   │   │   ├── list.ts
│   │   │   └── publish.ts
│   │   └── payments/
│   │       ├── charge.ts
│   │       └── refund.ts
│   │
│   ├── workflows/                    # Workflow definitions
│   │   ├── user-onboarding.ts
│   │   ├── post-publishing.ts
│   │   └── payment-processing.ts
│   │
│   ├── lib/                          # Shared code
│   │   ├── db.ts                     # Database client
│   │   ├── redis.ts                  # Cache client
│   │   ├── storage.ts                # Object storage (S3)
│   │   ├── queue.ts                  # Background jobs
│   │   └── utils.ts
│   │
│   ├── middleware/                   # Custom middleware
│   │   ├── auth.ts
│   │   └── rateLimit.ts
│   │
│   └── types/                        # Shared TypeScript types
│       └── index.ts
│
├── workflows/                        # Workflow files (auto-discovered)
│   └── (symlink to src/workflows/)
│
├── tests/
│   ├── procedures/
│   │   ├── users.test.ts
│   │   └── payments.test.ts
│   ├── workflows/
│   │   └── user-onboarding.test.ts
│   └── integration/
│       └── api.test.ts
│
├── migrations/                       # Database migrations
│   ├── 001_create_users.sql
│   ├── 002_create_posts.sql
│   └── 003_add_payments.sql
│
├── scripts/
│   ├── seed-dev.ts                   # Seed dev database
│   └── generate-client.ts            # Generate TypeScript client
│
├── .env.example                      # Environment template
├── .env.local                        # Local dev (gitignored)
├── .env.test                         # Test environment (gitignored)
├── .gitignore
├── tsdev.config.ts                   # Platform configuration
├── package.json
├── tsconfig.json
├── biome.json                        # Linter config
└── README.md
```

---

## Configuration Files

### `tsdev.config.ts` (Platform Configuration)

```typescript
import { defineConfig } from '@tsdev/config';

export default defineConfig({
  // Project metadata
  name: 'my-backend-api',
  version: '1.0.0',
  
  // Runtime configuration
  runtime: {
    node: '20',                        // Node.js version
    packageManager: 'pnpm',            // npm, pnpm, yarn, bun
    startCommand: 'tsdev serve all',   // Start command
    buildCommand: 'pnpm build',        // Build command (if needed)
    healthCheckPath: '/health',        // Health check endpoint
    port: 3000,                        // Default port
  },
  
  // Handlers & workflows
  handlers: {
    path: './src/handlers',            // Auto-discovery path
    exclude: ['**/*.test.ts'],
  },
  
  workflows: {
    path: './workflows',
    autoRegister: true,
  },
  
  // Platform services
  databases: [
    {
      name: 'main',
      type: 'postgres',
      version: '16',
      plan: 'starter',                 // starter, pro, enterprise
      extensions: ['uuid-ossp', 'pgvector'],
    }
  ],
  
  caches: [
    {
      name: 'session',
      type: 'redis',
      version: '7',
      maxMemory: '256mb',
      evictionPolicy: 'allkeys-lru',
    }
  ],
  
  storage: [
    {
      name: 'uploads',
      type: 's3',
      public: true,                    // Public read access
      cors: true,
    }
  ],
  
  // Environment variables (references to secrets)
  env: {
    // Public variables (safe to commit)
    NODE_ENV: 'production',
    LOG_LEVEL: 'info',
    
    // Secret references (actual values in platform)
    DATABASE_URL: '@secret:main-db-url',
    REDIS_URL: '@secret:redis-url',
    STRIPE_SECRET_KEY: '@secret:stripe-key',
    JWT_SECRET: '@secret:jwt-secret',
  },
  
  // Scaling configuration
  scaling: {
    minInstances: 1,
    maxInstances: 10,
    targetCPU: 70,                     // Scale at 70% CPU
    targetMemory: 80,                  // Scale at 80% memory
    scaleToZero: false,                // Keep at least 1 instance
  },
  
  // Resource limits
  resources: {
    cpu: '1000m',                      // 1 vCPU
    memory: '512Mi',                   // 512 MB RAM
  },
  
  // Custom domains
  domains: [
    'api.myapp.com',
  ],
  
  // Cron jobs (scheduled workflows)
  cron: [
    {
      name: 'daily-report',
      schedule: '0 9 * * *',           // Every day at 9 AM
      workflow: 'generate-daily-report',
      timezone: 'America/New_York',
    }
  ],
  
  // Background workers
  workers: [
    {
      name: 'email-sender',
      workflow: 'process-email-queue',
      concurrency: 5,
      queue: 'emails',
    }
  ],
  
  // Observability
  observability: {
    logs: {
      level: 'info',                   // debug, info, warn, error
      format: 'json',
    },
    metrics: {
      enabled: true,
    },
    tracing: {
      enabled: true,
      sampleRate: 0.1,                 // Sample 10% of requests
    },
  },
  
  // Regional deployment
  regions: ['us-east', 'eu-west'],     // Multi-region
  
  // CI/CD
  ci: {
    testCommand: 'pnpm test',
    lintCommand: 'pnpm lint',
    typecheck: true,
    
    // Preview deployments
    preview: {
      enabled: true,
      autoDelete: true,                // Delete when PR closes
    },
  },
});
```

### `package.json`

```json
{
  "name": "my-backend-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsdev dev",
    "build": "tsc",
    "test": "vitest",
    "test:watch": "vitest watch",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "typecheck": "tsc --noEmit",
    
    "db:migrate": "tsdev db:migrate",
    "db:seed": "tsx scripts/seed-dev.ts",
    "db:studio": "tsdev db:studio",
    
    "generate:client": "tsdev generate client --out ./client/index.ts",
    "generate:openapi": "tsdev generate openapi --out ./openapi.json",
    
    "deploy": "tsdev deploy",
    "logs": "tsdev logs --tail 100 --follow"
  },
  "dependencies": {
    "@tsdev/core": "^1.0.0",
    "@tsdev/adapters": "^1.0.0",
    "@tsdev/workflow": "^1.0.0",
    "@tsdev/policies": "^1.0.0",
    "zod": "^4.1.12",
    "postgres": "^3.4.5",
    "ioredis": "^5.4.2",
    "@aws-sdk/client-s3": "^3.700.0"
  },
  "devDependencies": {
    "@tsdev/cli": "^1.0.0",
    "@types/node": "^24.7.2",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4",
    "tsx": "^4.20.6",
    "@biomejs/biome": "^2.2.6"
  }
}
```

---

## Local Development

### Development Workflow

```bash
# Start development server (all services)
tsdev dev

# Start only specific services
tsdev dev --rpc                        # Only RPC endpoint
tsdev dev --workflow                   # Only workflow engine
tsdev dev --ui                         # Only workflow UI

# Connect to platform services (without deploying)
tsdev dev --platform-db                # Use platform PostgreSQL
tsdev dev --platform-redis             # Use platform Redis

# Run with specific environment
tsdev dev --env staging

# Debug mode (verbose logging)
tsdev dev --debug

# Hot reload (default)
# Changes to handlers/workflows auto-reload
```

### Local Platform Services

```bash
# Start local database (Docker)
tsdev db:local start

# 🐘 PostgreSQL started on localhost:5432
# 📊 Database: my-backend-api-dev
# 👤 User: tsdev
# 🔑 Password: local

# Open database studio (GUI)
tsdev db:studio

# Run migrations
tsdev db:migrate

# Seed with test data
pnpm run db:seed

# Stop local services
tsdev db:local stop
```

### Environment Variables

```bash
# .env.local (local development)
DATABASE_URL=postgresql://tsdev:local@localhost:5432/my-backend-api-dev
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# API keys (for development)
STRIPE_SECRET_KEY=sk_test_...
SENDGRID_API_KEY=SG.test...
```

---

## Writing Procedures

### 1. Define Contract

```typescript
// src/contracts/users.ts
import { z } from 'zod';
import type { Contract } from '@tsdev/core';

export const createUserContract: Contract = {
  name: 'users.create',
  description: 'Create a new user account',
  
  input: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['user', 'admin']).default('user'),
  }),
  
  output: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    createdAt: z.string().datetime(),
  }),
  
  metadata: {
    // Visibility
    exposure: 'external',              // 'external' | 'internal'
    roles: ['api-endpoint', 'workflow-node'],
    
    // Documentation
    category: 'users',
    tags: ['users', 'write', 'auth'],
    
    // API behavior
    rateLimit: {
      maxRequests: 10,
      windowMs: 60000,                 // 10 requests per minute
    },
    
    // Caching
    cache: {
      ttl: 0,                          // No cache (write operation)
    },
    
    // Auth requirement
    auth: {
      required: false,                 // No auth for signup
    },
  },
};

export const getUserContract: Contract = {
  name: 'users.get',
  description: 'Get user by ID',
  
  input: z.object({
    id: z.string().uuid(),
  }),
  
  output: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    createdAt: z.string().datetime(),
  }),
  
  metadata: {
    exposure: 'external',
    roles: ['api-endpoint', 'workflow-node', 'sdk-client'],
    category: 'users',
    tags: ['users', 'read'],
    
    // Caching for read operations
    cache: {
      ttl: 300,                        // Cache for 5 minutes
      key: (input) => `user:${input.id}`,
    },
    
    auth: {
      required: true,
      scopes: ['users:read'],
    },
  },
};
```

### 2. Implement Handler

```typescript
// src/handlers/users/create.ts
import type { Procedure } from '@tsdev/core';
import { createUserContract } from '../../contracts/users.js';
import { db } from '../../lib/db.js';
import { hash } from '../../lib/crypto.js';
import { redis } from '../../lib/redis.js';

export const createUser: Procedure = {
  contract: createUserContract,
  
  handler: async (input, context) => {
    // Hash password
    const passwordHash = await hash(input.password);
    
    // Insert into database
    const [user] = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [input.name, input.email, passwordHash, input.role]
    );
    
    // Invalidate user list cache
    await redis.del('users:list:*');
    
    // Log for audit
    console.log(`[${context.requestId}] Created user ${user.id}`);
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.created_at,
    };
  },
};
```

### 3. Add Policies (Middleware)

```typescript
// src/handlers/users/get.ts
import { applyPolicies } from '@tsdev/core';
import { withAuth, withCache, withRateLimit, withSpan } from '@tsdev/policies';
import type { Procedure } from '@tsdev/core';
import { getUserContract } from '../../contracts/users.js';
import { db } from '../../lib/db.js';

// Base handler
const getUserHandler = async (input: { id: string }) => {
  const [user] = await db.query(
    `SELECT id, name, email, role, created_at
     FROM users WHERE id = $1`,
    [input.id]
  );
  
  if (!user) {
    throw new Error('User not found');
  }
  
  return user;
};

// Apply policies (middleware)
export const getUser: Procedure = {
  contract: getUserContract,
  
  handler: applyPolicies(
    getUserHandler,
    withSpan('users.get'),             // OpenTelemetry tracing
    withAuth({ scopes: ['users:read'] }), // Authentication
    withCache({ ttl: 300 }),           // Cache for 5 minutes
    withRateLimit({ maxRequests: 100, windowMs: 60000 }),
  ),
};
```

### Testing Procedures

```typescript
// tests/procedures/users.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createExecutionContext } from '@tsdev/core';
import { createUser, getUser } from '../../src/handlers/users/index.js';

describe('Users Procedures', () => {
  let testContext: ExecutionContext;
  
  beforeEach(() => {
    testContext = createExecutionContext({
      transport: 'test',
      requestId: 'test-req-123',
    });
  });
  
  it('should create a user', async () => {
    const input = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'secure123',
      role: 'user',
    };
    
    const result = await createUser.handler(input, testContext);
    
    expect(result).toMatchObject({
      id: expect.any(String),
      name: 'John Doe',
      email: 'john@example.com',
      role: 'user',
    });
    expect(result.createdAt).toBeTruthy();
  });
  
  it('should get a user by id', async () => {
    // First create
    const created = await createUser.handler({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'secure123',
      role: 'user',
    }, testContext);
    
    // Then get
    const result = await getUser.handler(
      { id: created.id },
      testContext
    );
    
    expect(result).toEqual(created);
  });
  
  it('should throw error if user not found', async () => {
    await expect(
      getUser.handler({ id: 'non-existent' }, testContext)
    ).rejects.toThrow('User not found');
  });
});
```

---

## Creating Workflows

### Simple Sequential Workflow

```typescript
// src/workflows/user-onboarding.ts
import { workflow, step } from '@tsdev/workflow';
import type { StepContext } from '@tsdev/workflow';
import { z } from 'zod';

// Step 1: Create user account
const createAccount = step({
  id: 'create-account',
  input: z.object({
    name: z.string(),
    email: z.string(),
    password: z.string(),
  }),
  output: z.object({
    id: z.string(),
    email: z.string(),
  }),
  execute: ({ engine, inputData }: StepContext<typeof input>) => 
    engine.run('users.create', inputData),
});

// Step 2: Send welcome email
const sendWelcomeEmail = step({
  id: 'send-welcome',
  input: createAccount.output,
  output: z.object({
    messageId: z.string(),
    status: z.string(),
  }),
  execute: ({ engine, variables }: StepContext<typeof input>) => 
    engine.run('emails.send', {
      to: variables.email,
      template: 'welcome',
      data: { name: variables.name },
    }),
});

// Step 3: Track signup event
const trackSignup = step({
  id: 'track-signup',
  input: sendWelcomeEmail.output,
  output: z.object({
    tracked: z.boolean(),
  }),
  execute: ({ engine, variables }: StepContext<typeof input>) => 
    engine.run('analytics.track', {
      event: 'user.signup',
      userId: variables.id,
      properties: {
        email: variables.email,
        source: 'web',
      },
    }),
});

// Compose workflow
export const userOnboardingWorkflow = workflow('user-onboarding')
  .name('User Onboarding')
  .description('Complete user registration with email and analytics')
  .version('1.0.0')
  .metadata({
    category: 'users',
    tags: ['onboarding', 'signup'],
  })
  .step(createAccount)
  .step(sendWelcomeEmail)
  .step(trackSignup)
  .commit();
```

### Conditional Workflow

```typescript
// src/workflows/order-processing.ts
import { workflow, step, condition } from '@tsdev/workflow';
import { z } from 'zod';

const validateOrder = step({
  id: 'validate-order',
  input: z.object({ orderId: z.string() }),
  output: z.object({
    valid: z.boolean(),
    amount: z.number(),
    items: z.array(z.any()),
  }),
  execute: ({ engine, inputData }) =>
    engine.run('orders.validate', inputData),
});

const checkInventory = step({
  id: 'check-inventory',
  input: validateOrder.output,
  output: z.object({
    inStock: z.boolean(),
    availableItems: z.array(z.any()),
  }),
  execute: ({ engine, variables }) =>
    engine.run('inventory.check', {
      items: variables.items,
    }),
});

// Conditional: check if premium customer
const checkPremium = condition({
  id: 'check-premium',
  input: checkInventory.output,
  predicate: (ctx) => {
    const amount = ctx.get('amount') as number;
    return amount > 100; // Premium if order > $100
  },
  whenTrue: 'premium-processing',
  whenFalse: 'standard-processing',
});

const premiumProcessing = step({
  id: 'premium-processing',
  input: z.object({}),
  output: z.object({ processed: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run('orders.process', {
      orderId: variables.orderId,
      priority: 'high',
      freeShipping: true,
    }),
});

const standardProcessing = step({
  id: 'standard-processing',
  input: z.object({}),
  output: z.object({ processed: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run('orders.process', {
      orderId: variables.orderId,
      priority: 'normal',
    }),
});

const sendConfirmation = step({
  id: 'send-confirmation',
  input: z.object({}),
  output: z.object({ sent: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run('emails.send', {
      to: variables.customerEmail,
      template: 'order-confirmation',
      data: { orderId: variables.orderId },
    }),
});

export const orderProcessingWorkflow = workflow('order-processing')
  .name('Order Processing')
  .description('Process customer orders with premium/standard paths')
  .version('1.0.0')
  .step(validateOrder)
  .step(checkInventory)
  .step(checkPremium)
  .step(premiumProcessing)    // Executes if premium
  .step(standardProcessing)   // Executes if not premium
  .step(sendConfirmation)
  .commit();
```

### Parallel Workflow

```typescript
// src/workflows/content-publishing.ts
import { workflow, step, parallel } from '@tsdev/workflow';
import { z } from 'zod';

const validateContent = step({
  id: 'validate',
  input: z.object({ postId: z.string() }),
  output: z.object({ valid: z.boolean(), post: z.any() }),
  execute: ({ engine, inputData }) =>
    engine.run('posts.validate', inputData),
});

// Parallel steps (independent operations)
const notifySubscribers = step({
  id: 'notify-subscribers',
  input: z.object({}),
  output: z.object({ notified: z.number() }),
  execute: ({ engine, variables }) =>
    engine.run('notifications.sendBatch', {
      postId: variables.postId,
      type: 'new-post',
    }),
});

const updateSearchIndex = step({
  id: 'update-search',
  input: z.object({}),
  output: z.object({ indexed: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run('search.index', {
      postId: variables.postId,
      content: variables.post,
    }),
});

const generateSocialPosts = step({
  id: 'generate-social',
  input: z.object({}),
  output: z.object({ tweets: z.array(z.string()) }),
  execute: ({ engine, variables }) =>
    engine.run('social.generatePosts', {
      postId: variables.postId,
      platforms: ['twitter', 'linkedin'],
    }),
});

const trackPublication = step({
  id: 'track',
  input: z.object({}),
  output: z.object({ tracked: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run('analytics.track', {
      event: 'post.published',
      postId: variables.postId,
    }),
});

// Run these in parallel
const parallelTasks = parallel({
  id: 'parallel-publishing',
  branches: [
    notifySubscribers,
    updateSearchIndex,
    generateSocialPosts,
    trackPublication,
  ],
  waitForAll: false,  // Don't wait for all (fire and forget)
});

export const contentPublishingWorkflow = workflow('content-publishing')
  .name('Content Publishing')
  .description('Publish content with parallel post-processing')
  .version('1.0.0')
  .step(validateContent)
  .step(parallelTasks)
  .commit();
```

### Error Handling & Retry

```typescript
// src/workflows/payment-processing.ts
import { workflow, step } from '@tsdev/workflow';
import { z } from 'zod';

const chargePayment = step({
  id: 'charge-payment',
  input: z.object({
    amount: z.number(),
    customerId: z.string(),
  }),
  output: z.object({
    chargeId: z.string(),
    status: z.string(),
  }),
  // Retry configuration for this step
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000,
  },
  execute: ({ engine, inputData }) =>
    engine.run('payments.charge', inputData),
});

const sendReceipt = step({
  id: 'send-receipt',
  input: chargePayment.output,
  output: z.object({ sent: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run('emails.send', {
      to: variables.customerEmail,
      template: 'receipt',
      data: { chargeId: variables.chargeId },
    }),
});

// Error handler step
const notifyAdmin = step({
  id: 'notify-admin',
  input: z.object({}),
  output: z.object({ notified: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run('notifications.admin', {
      message: `Payment failed for customer ${variables.customerId}`,
      severity: 'high',
    }),
});

export const paymentProcessingWorkflow = workflow('payment-processing')
  .name('Payment Processing')
  .description('Process payments with retry and error handling')
  .version('1.0.0')
  .step(chargePayment)
    .onError('notify-admin')  // If charge fails, notify admin
  .step(sendReceipt)
  .step(notifyAdmin)          // Error handler step
  .commit();
```

### Testing Workflows

```typescript
// tests/workflows/user-onboarding.test.ts
import { describe, it, expect } from 'vitest';
import { executeWorkflow } from '@tsdev/workflow';
import { collectRegistry } from '@tsdev/core';
import { userOnboardingWorkflow } from '../../src/workflows/user-onboarding.js';

describe('User Onboarding Workflow', () => {
  it('should complete all steps', async () => {
    const registry = await collectRegistry('./src/handlers');
    
    const result = await executeWorkflow(
      userOnboardingWorkflow,
      registry,
      {
        name: 'Test User',
        email: 'test@example.com',
        password: 'secure123',
      }
    );
    
    expect(result.status).toBe('completed');
    expect(result.nodesExecuted).toEqual([
      'create-account',
      'send-welcome',
      'track-signup',
    ]);
    expect(result.outputs['create-account']).toHaveProperty('id');
  });
  
  it('should handle errors gracefully', async () => {
    const registry = await collectRegistry('./src/handlers');
    
    const result = await executeWorkflow(
      userOnboardingWorkflow,
      registry,
      {
        name: '',  // Invalid input
        email: 'invalid-email',
        password: '123',
      }
    );
    
    expect(result.status).toBe('failed');
    expect(result.error).toBeTruthy();
  });
});
```

---

## Deployment

### Manual Deploy

```bash
# Deploy to production
tsdev deploy

# 🚀 Deploying to production...
# ✅ Running tests...
# ✅ Building Docker image...
# ✅ Pushing to registry...
# ✅ Updating deployment...
# ✅ Health checks passed
# ✅ Deployed version v1.2.3
# 
# 🌐 Live at: https://api.myapp.com
# 📊 Dashboard: https://app.tsdev.run/projects/my-backend-api

# Deploy to staging
tsdev deploy --env staging

# Deploy specific branch
tsdev deploy --branch feature/new-api

# Deploy with specific build
tsdev deploy --build b-abc123

# Rollback to previous version
tsdev rollback

# Rollback to specific deployment
tsdev rollback d-xyz789
```

### Git-based Deployment (Automatic)

```bash
# Push to main = auto-deploy to production
git push origin main

# Create PR = auto-create preview deployment
git checkout -b feature/new-endpoint
# ... make changes ...
git push origin feature/new-endpoint

# GitHub/GitLab creates PR
# tsdev bot comments:
# 
# 🚀 Preview deployment created!
# 🌐 https://pr-42-my-backend-api.tsdev.run
# 📊 Logs: https://app.tsdev.run/deployments/d-preview-42
# ⏱️ Build time: 1m 23s
#
# Changes:
# - 3 new procedures
# - 1 modified workflow
# - Database migration: 001_add_posts_table.sql
```

### Deployment Configuration

```typescript
// tsdev.config.ts

export default defineConfig({
  // ...
  
  ci: {
    // Run before deployment
    testCommand: 'pnpm test',
    lintCommand: 'pnpm lint',
    typecheck: true,
    
    // Migration handling
    migrations: {
      auto: true,                      // Auto-run migrations on deploy
      rollbackOnFailure: true,
    },
    
    // Preview deployments
    preview: {
      enabled: true,
      autoDelete: true,                // Delete when PR closes
      lifetime: '7d',                  // Max lifetime
      
      // Resource limits for previews
      resources: {
        cpu: '500m',
        memory: '256Mi',
      },
      
      // Environment
      env: 'preview',
      
      // Copy data from staging (optional)
      cloneData: false,
    },
    
    // Health checks
    healthCheck: {
      path: '/health',
      timeout: '30s',
      retries: 3,
    },
    
    // Smoke tests after deploy
    smokeTest: {
      command: 'pnpm test:smoke',
      timeout: '2m',
    },
  },
});
```

---

## Platform Services

### PostgreSQL Database

```typescript
// src/lib/db.ts
import postgres from 'postgres';

// Connection URL injected by platform
const sql = postgres(process.env.DATABASE_URL!);

export { sql as db };
```

**Usage in handler:**

```typescript
// src/handlers/posts/list.ts
import { db } from '../../lib/db.js';

export const listPosts: Procedure = {
  contract: listPostsContract,
  handler: async (input) => {
    const posts = await db`
      SELECT id, title, content, author_id, created_at
      FROM posts
      WHERE published = true
      ORDER BY created_at DESC
      LIMIT ${input.limit || 10}
      OFFSET ${input.offset || 0}
    `;
    
    return { posts };
  },
};
```

**Database management:**

```bash
# Create database
tsdev db:create postgres --name main-db --plan pro

# ✅ PostgreSQL database created
# 📊 Name: main-db
# 🔧 Version: 16.1
# 💾 Storage: 10GB
# 🔗 Connection: postgresql://user:pass@db-abc123.tsdev.run:5432/main-db

# Connection string automatically added to environment

# Run migrations
tsdev db:migrate

# Create migration
tsdev db:migration create add_posts_table

# Rollback migration
tsdev db:migrate:rollback

# Open database studio (GUI)
tsdev db:studio

# Database backups
tsdev db:backup create
tsdev db:backup list
tsdev db:backup restore b-abc123

# Point-in-time recovery
tsdev db:recover --timestamp "2024-01-15T10:30:00Z"
```

### Redis Cache

```typescript
// src/lib/redis.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

export { redis };
```

**Usage:**

```typescript
// src/handlers/users/get.ts
import { redis } from '../../lib/redis.js';

export const getUser: Procedure = {
  contract: getUserContract,
  handler: async (input) => {
    const cacheKey = `user:${input.id}`;
    
    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Fetch from database
    const [user] = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [input.id]
    );
    
    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(user));
    
    return user;
  },
};
```

**Redis management:**

```bash
# Create Redis instance
tsdev cache:create redis --name session-cache

# Redis CLI
tsdev cache:cli session-cache

# Monitor
tsdev cache:monitor

# Flush cache
tsdev cache:flush session-cache
```

### Object Storage (S3)

```typescript
// src/lib/storage.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

export { s3 };
```

**Usage:**

```typescript
// src/handlers/uploads/create.ts
import { s3 } from '../../lib/storage.js';

export const uploadFile: Procedure = {
  contract: uploadFileContract,
  handler: async (input) => {
    const key = `uploads/${Date.now()}-${input.filename}`;
    
    await s3.send(new PutObjectCommand({
      Bucket: 'my-bucket',
      Key: key,
      Body: input.file,
      ContentType: input.contentType,
    }));
    
    const url = `https://cdn.myapp.com/${key}`;
    
    return { url, key };
  },
};
```

**Storage management:**

```bash
# Create bucket
tsdev storage:create s3 --name uploads --public

# List buckets
tsdev storage:list

# Upload file (CLI)
tsdev storage:upload ./image.png uploads/

# Generate signed URL
tsdev storage:sign uploads/file.pdf --expires 3600
```

---

## Monitoring & Debugging

### Real-time Logs

```bash
# Tail logs (like Vercel)
tsdev logs --tail 100 --follow

# [2024-01-15 10:30:45] [info] POST /rpc/users.create 201 45ms
# [2024-01-15 10:30:46] [info] [users.create] Creating user alice@example.com
# [2024-01-15 10:30:46] [info] [users.create] User created: user_abc123
# [2024-01-15 10:30:47] [info] POST /rpc/emails.send 200 1.2s

# Filter by level
tsdev logs --level error

# Filter by procedure
tsdev logs --procedure users.create

# Filter by time range
tsdev logs --since 1h
tsdev logs --since "2024-01-15 10:00"

# Filter by request ID
tsdev logs --request-id req-abc123

# Export logs
tsdev logs --since 24h --format json > logs.json
```

### Metrics Dashboard

```bash
# Open metrics dashboard
tsdev metrics

# Dashboard shows:
# - Request rate (req/s)
# - Latency (p50, p95, p99)
# - Error rate (%)
# - Active instances
# - CPU/Memory usage
# - Database queries
# - Cache hit rate
# - Workflow executions
```

### Distributed Tracing

```bash
# Open tracing UI (Jaeger-like)
tsdev traces

# Search traces
tsdev traces --procedure users.create
tsdev traces --duration ">1s"
tsdev traces --error

# View specific trace
tsdev traces:show t-abc123

# Trace waterfall:
# workflow.execute                    2.5s
# ├─ workflow.node.procedure: create  1.2s
# │  └─ procedure.users.create        1.1s
# │     ├─ db.query                   0.8s
# │     └─ redis.del                  0.1s
# ├─ workflow.node.procedure: email   800ms
# │  └─ procedure.emails.send         750ms
# └─ workflow.node.procedure: track   150ms
```

### Debugging

```bash
# Enable debug mode for single request
curl -X POST https://api.myapp.com/rpc/users.create \
  -H "X-Debug: true" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'

# Returns:
# {
#   "result": { "id": "user_123", ... },
#   "debug": {
#     "requestId": "req-abc123",
#     "duration": 45,
#     "queries": [
#       { "sql": "INSERT INTO users ...", "duration": 12 }
#     ],
#     "cache": {
#       "hits": 0,
#       "misses": 1
#     },
#     "trace": { "traceId": "t-xyz789" }
#   }
# }

# Remote debugging (forward logs to local)
tsdev dev --remote

# This starts local server that forwards requests to production
# and shows logs locally
```

### Alerts

```bash
# Configure alerts (via dashboard or config)
tsdev alerts:create \
  --name "High Error Rate" \
  --condition "error_rate > 5%" \
  --duration "5m" \
  --channel slack

# Alert channels:
# - Slack
# - Email
# - PagerDuty
# - Webhook
# - Discord

# Test alert
tsdev alerts:test "High Error Rate"
```

---

## Team Collaboration

### Projects & Organizations

```bash
# Create organization
tsdev orgs:create my-company

# Invite team members
tsdev members:invite alice@example.com --role developer
tsdev members:invite bob@example.com --role admin

# Roles:
# - owner: Full access
# - admin: Manage team, deployments, settings
# - developer: Deploy, view logs, manage env vars
# - viewer: Read-only access
```

### Access Control

```typescript
// tsdev.config.ts

export default defineConfig({
  // ...
  
  team: {
    members: [
      { email: 'alice@example.com', role: 'admin' },
      { email: 'bob@example.com', role: 'developer' },
    ],
    
    // Branch protection
    branches: {
      main: {
        requireReview: true,
        requiredApprovals: 2,
        allowedDeployers: ['admin', 'owner'],
      },
      staging: {
        requireReview: false,
        allowedDeployers: ['developer', 'admin', 'owner'],
      },
    },
  },
});
```

### Shared Environments

```bash
# Create shared staging environment
tsdev env:create staging

# Promote staging → production
tsdev env:promote staging production

# Environment variables per environment
tsdev secrets:set API_KEY xxx --env staging
tsdev secrets:set API_KEY yyy --env production
```

---

## Complete Example: E-commerce Backend

### Project Structure

```
ecommerce-backend/
├── src/
│   ├── contracts/
│   │   ├── products.ts
│   │   ├── orders.ts
│   │   ├── payments.ts
│   │   └── inventory.ts
│   │
│   ├── handlers/
│   │   ├── products/
│   │   │   ├── create.ts
│   │   │   ├── list.ts
│   │   │   ├── get.ts
│   │   │   └── update.ts
│   │   ├── orders/
│   │   │   ├── create.ts
│   │   │   ├── process.ts
│   │   │   └── cancel.ts
│   │   ├── payments/
│   │   │   ├── charge.ts
│   │   │   └── refund.ts
│   │   └── inventory/
│   │       ├── check.ts
│   │       └── reserve.ts
│   │
│   ├── workflows/
│   │   ├── order-processing.ts      # Main checkout flow
│   │   ├── payment-processing.ts     # Handle payments
│   │   ├── fulfillment.ts           # Shipping & delivery
│   │   └── refund-processing.ts     # Returns & refunds
│   │
│   └── lib/
│       ├── db.ts
│       ├── redis.ts
│       ├── storage.ts
│       └── stripe.ts
│
├── migrations/
│   ├── 001_create_products.sql
│   ├── 002_create_orders.sql
│   ├── 003_create_payments.sql
│   └── 004_create_inventory.sql
│
├── tsdev.config.ts
└── package.json
```

### Complete Workflow Example

```typescript
// src/workflows/order-processing.ts
import { workflow, step, condition, parallel } from '@tsdev/workflow';
import { z } from 'zod';

// Step 1: Validate order
const validateOrder = step({
  id: 'validate-order',
  input: z.object({
    customerId: z.string(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number(),
    })),
  }),
  output: z.object({
    valid: z.boolean(),
    totalAmount: z.number(),
    items: z.array(z.any()),
  }),
  retry: { maxAttempts: 2 },
  execute: ({ engine, inputData }) =>
    engine.run('orders.validate', inputData),
});

// Step 2: Check inventory
const checkInventory = step({
  id: 'check-inventory',
  input: validateOrder.output,
  output: z.object({
    available: z.boolean(),
    reservationId: z.string().optional(),
  }),
  execute: ({ engine, variables }) =>
    engine.run('inventory.check', {
      items: variables.items,
    }),
});

// Condition: Is inventory available?
const inventoryCheck = condition({
  id: 'inventory-available',
  input: checkInventory.output,
  predicate: (ctx) => ctx.get('available') === true,
  whenTrue: 'charge-payment',
  whenFalse: 'notify-out-of-stock',
});

// Step 3: Charge payment
const chargePayment = step({
  id: 'charge-payment',
  input: z.object({}),
  output: z.object({
    chargeId: z.string(),
    status: z.string(),
  }),
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
  },
  execute: ({ engine, variables }) =>
    engine.run('payments.charge', {
      customerId: variables.customerId,
      amount: variables.totalAmount,
    }),
  onError: 'payment-failed',
});

// Step 4: Create order
const createOrder = step({
  id: 'create-order',
  input: chargePayment.output,
  output: z.object({
    orderId: z.string(),
  }),
  execute: ({ engine, variables }) =>
    engine.run('orders.create', {
      customerId: variables.customerId,
      items: variables.items,
      totalAmount: variables.totalAmount,
      chargeId: variables.chargeId,
    }),
});

// Step 5: Parallel post-processing
const sendConfirmationEmail = step({
  id: 'send-confirmation',
  input: z.object({}),
  output: z.object({ sent: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run('emails.send', {
      to: variables.customerEmail,
      template: 'order-confirmation',
      data: {
        orderId: variables.orderId,
        items: variables.items,
        total: variables.totalAmount,
      },
    }),
});

const updateInventory = step({
  id: 'update-inventory',
  input: z.object({}),
  output: z.object({ updated: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run('inventory.reserve', {
      orderId: variables.orderId,
      reservationId: variables.reservationId,
    }),
});

const trackPurchase = step({
  id: 'track-purchase',
  input: z.object({}),
  output: z.object({ tracked: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run('analytics.track', {
      event: 'order.created',
      userId: variables.customerId,
      properties: {
        orderId: variables.orderId,
        amount: variables.totalAmount,
      },
    }),
});

const createShipment = step({
  id: 'create-shipment',
  input: z.object({}),
  output: z.object({ shipmentId: z.string() }),
  execute: ({ engine, variables }) =>
    engine.run('shipments.create', {
      orderId: variables.orderId,
      items: variables.items,
    }),
});

const parallelTasks = parallel({
  id: 'post-processing',
  branches: [
    sendConfirmationEmail,
    updateInventory,
    trackPurchase,
    createShipment,
  ],
  waitForAll: true,
});

// Error handlers
const notifyOutOfStock = step({
  id: 'notify-out-of-stock',
  input: z.object({}),
  output: z.object({ notified: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run('emails.send', {
      to: variables.customerEmail,
      template: 'out-of-stock',
    }),
});

const paymentFailed = step({
  id: 'payment-failed',
  input: z.object({}),
  output: z.object({ notified: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run('emails.send', {
      to: variables.customerEmail,
      template: 'payment-failed',
    }),
});

// Compose full workflow
export const orderProcessingWorkflow = workflow('order-processing')
  .name('Order Processing')
  .description('Complete order processing from checkout to fulfillment')
  .version('2.0.0')
  .metadata({
    category: 'orders',
    tags: ['checkout', 'payments', 'fulfillment'],
  })
  .step(validateOrder)
  .step(checkInventory)
  .step(inventoryCheck)
  .step(chargePayment)
  .step(createOrder)
  .step(parallelTasks)
  .step(notifyOutOfStock)     // Error path
  .step(paymentFailed)        // Error path
  .commit();
```

---

## Summary: Developer Experience

### ✅ What makes tsdev DX great:

1. **Zero Config** - `tsdev init` → working app
2. **Type Safety** - Zod contracts → full type inference
3. **Auto Discovery** - Drop file in `/handlers` → auto-registered
4. **Hot Reload** - Change handler → instant reload
5. **Git-based Deploy** - Push to main → auto-deploy
6. **Preview Environments** - PR → instant preview URL
7. **Built-in Observability** - Logs, metrics, traces out of the box
8. **Platform Services** - PostgreSQL, Redis, S3 with one command
9. **Workflow Engine** - Complex logic as declarative code
10. **CLI-first** - Everything possible via CLI

### 🎯 Developer Journey (5 minutes)

```bash
1. tsdev init my-api             # 10s
2. cd my-api && pnpm install     # 20s
3. tsdev dev                      # 5s  → localhost:3000
4. # Write handlers...           # 2m
5. tsdev deploy                   # 2m  → production URL
```

### 🚀 Production-ready from Day 1

- ✅ SSL certificates (automatic)
- ✅ Load balancing
- ✅ Auto-scaling
- ✅ Database backups
- ✅ Monitoring & alerts
- ✅ Log aggregation
- ✅ Distributed tracing
- ✅ CI/CD pipeline
- ✅ Preview deployments
- ✅ Rollback support

---

**This is the DX goal for tsdev PaaS** 🎯
