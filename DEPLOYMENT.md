# tsdev Deployment Guide

Стратегии развертывания приложений на базе tsdev фреймворка.

---

## Обзор

tsdev приложения могут развертываться в разных конфигурациях:

1. **HTTP API Server** - RPC/REST endpoints для процедур
2. **Workflow Server** - Выполнение workflow с OpenTelemetry
3. **Next.js UI** - Визуализация и управление workflow
4. **CLI Tools** - Command-line интерфейс для процедур
5. **Serverless Functions** - Lambda/Edge functions

---

## Архитектура развертывания

### Монолитное развертывание
```
┌─────────────────────────────────────┐
│     Single Container/Server         │
│  ┌──────────────────────────────┐   │
│  │  HTTP Server (port 3000)     │   │
│  │  - Procedures (/rpc/*)       │   │
│  │  - Workflows (/workflow/*)   │   │
│  │  - Introspection (/procedures)│  │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │  Registry (auto-discovered)  │   │
│  │  - handlers/*.ts             │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Плюсы:**
- Простота развертывания
- Низкая latency между компонентами
- Проще debugging

**Минусы:**
- Все в одном процессе
- Сложнее масштабировать отдельные части

### Микросервисная архитектура
```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  API Gateway     │────▶│  Procedure       │     │  Workflow        │
│  (REST/RPC)      │     │  Service         │────▶│  Orchestrator    │
│  Port 3000       │     │  Port 3001       │     │  Port 3002       │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                        │                         │
         └────────────────────────┴─────────────────────────┘
                                  │
                          ┌───────▼────────┐
                          │  Shared DB/    │
                          │  Message Queue │
                          └────────────────┘
```

**Плюсы:**
- Независимое масштабирование
- Изоляция сервисов
- Технологическая гибкость

**Минусы:**
- Сложнее настройка
- Network overhead
- Distributed tracing необходим

---

## 1. Docker Deployment

### Простой HTTP Server (Рекомендуется для начала)

**Dockerfile:**
```dockerfile
FROM node:20-alpine AS base

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages

# Install dependencies
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# Build packages
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @tsdev/core build
RUN pnpm --filter @tsdev/workflow build
RUN pnpm --filter @tsdev/policies build
RUN pnpm --filter @tsdev/generators build
RUN pnpm --filter @tsdev/adapters build

# Application stage
FROM base AS app-build
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/packages /app/packages

# Copy your application code
COPY src ./src
COPY tsconfig.json ./

# Build your application
RUN pnpm build

# Production image
FROM node:20-alpine AS production

WORKDIR /app

# Copy built packages
COPY --from=app-build /app/packages /app/packages
COPY --from=app-build /app/dist /app/dist
COPY --from=app-build /app/node_modules /app/node_modules
COPY --from=app-build /app/package.json /app/package.json

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/server.js"]
```

**.dockerignore:**
```
node_modules
dist
.git
.github
*.md
*.log
.env*
!.env.example
coverage
.next
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - LOG_LEVEL=info
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    
  # OpenTelemetry Collector (optional)
  otel-collector:
    image: otel/opentelemetry-collector:latest
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4317:4317"   # OTLP gRPC receiver
      - "4318:4318"   # OTLP HTTP receiver
      - "8888:8888"   # Prometheus metrics
    restart: unless-stopped

  # Jaeger for trace visualization (optional)
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # Jaeger UI
      - "14268:14268"  # Jaeger collector
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    restart: unless-stopped
```

**Запуск:**
```bash
# Сборка
docker-compose build

# Запуск
docker-compose up -d

# Проверка
curl http://localhost:3000/procedures

# Логи
docker-compose logs -f api

# Остановка
docker-compose down
```

---

## 2. Kubernetes Deployment

### Базовая конфигурация

**deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tsdev-api
  labels:
    app: tsdev-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: tsdev-api
  template:
    metadata:
      labels:
        app: tsdev-api
    spec:
      containers:
      - name: api
        image: your-registry/tsdev-api:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: OTEL_EXPORTER_OTLP_ENDPOINT
          value: "http://otel-collector:4318"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: tsdev-api
spec:
  selector:
    app: tsdev-api
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tsdev-api
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: tsdev-api-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: tsdev-api
            port:
              number: 80
```

**Horizontal Pod Autoscaling:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: tsdev-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: tsdev-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Применение:**
```bash
kubectl apply -f deployment.yaml
kubectl apply -f hpa.yaml

# Проверка
kubectl get pods -l app=tsdev-api
kubectl get svc tsdev-api
kubectl logs -l app=tsdev-api -f
```

---

## 3. Serverless Deployment

### AWS Lambda

**lambda-handler.ts:**
```typescript
import { collectRegistry, executeProcedure, createExecutionContext } from '@tsdev/core';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

let registry: Registry | null = null;

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Lazy init registry (cold start optimization)
    if (!registry) {
      registry = await collectRegistry('./handlers');
    }

    const path = event.path;
    const method = event.httpMethod;

    // Introspection
    if (path === '/procedures' && method === 'GET') {
      const procedures = Array.from(registry.entries()).map(([name, proc]) => ({
        name,
        description: proc.contract.description,
        input: proc.contract.input,
        output: proc.contract.output,
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ procedures }),
      };
    }

    // RPC execution
    if (path.startsWith('/rpc/') && method === 'POST') {
      const procedureName = path.slice(5);
      const procedure = registry.get(procedureName);
      
      if (!procedure) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Procedure not found' }),
        };
      }

      const input = JSON.parse(event.body || '{}');
      const context = createExecutionContext({
        transport: 'lambda',
        requestId: event.requestContext.requestId,
        sourceIp: event.requestContext.identity.sourceIp,
      });

      const result = await executeProcedure(procedure, input, context);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      };
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal error' 
      }),
    };
  }
}
```

**serverless.yml (Serverless Framework):**
```yaml
service: tsdev-api

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  memorySize: 512
  timeout: 30
  environment:
    NODE_ENV: production
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - logs:CreateLogGroup
            - logs:CreateLogStream
            - logs:PutLogEvents
          Resource: "*"

functions:
  api:
    handler: dist/lambda-handler.handler
    events:
      - httpApi:
          path: /{proxy+}
          method: ANY
    
package:
  individually: true
  patterns:
    - dist/**
    - handlers/**
    - node_modules/**
    - '!node_modules/.cache/**'

plugins:
  - serverless-esbuild

custom:
  esbuild:
    bundle: true
    minify: true
    target: node20
    platform: node
    external:
      - '@aws-sdk/*'
```

**Развертывание:**
```bash
# Установка Serverless Framework
npm install -g serverless

# Сборка
pnpm build

# Развертывание
serverless deploy --stage production

# Тестирование
serverless invoke --function api --path test-event.json

# Логи
serverless logs --function api --tail
```

### Vercel (для Next.js + API)

**vercel.json:**
```json
{
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": ".next",
  "regions": ["iad1"],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 10
    }
  },
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ]
}
```

---

## 4. Platform-as-a-Service (PaaS)

### Railway

**railway.toml:**
```toml
[build]
builder = "NIXPACKS"
buildCommand = "pnpm install && pnpm build"

[deploy]
startCommand = "node dist/server.js"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[services]]
name = "api"

[services.env]
NODE_ENV = "production"
PORT = "3000"
```

### Render

**render.yaml:**
```yaml
services:
  - type: web
    name: tsdev-api
    env: node
    region: oregon
    plan: starter
    buildCommand: pnpm install && pnpm build
    startCommand: node dist/server.js
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
    autoDeploy: true
```

### Fly.io

**fly.toml:**
```toml
app = "tsdev-api"
primary_region = "iad"

[build]
  builder = "paketobuildpacks/builder:base"
  buildpacks = ["gcr.io/paketo-buildpacks/nodejs"]

[env]
  NODE_ENV = "production"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

[[services]]
  http_checks = []
  internal_port = 8080
  processes = ["app"]
  protocol = "tcp"
  script_checks = []

  [services.concurrency]
    hard_limit = 25
    soft_limit = 20
    type = "connections"

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [[services.tcp_checks]]
    grace_period = "1s"
    interval = "15s"
    restart_limit = 0
    timeout = "2s"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

**Развертывание:**
```bash
# Railway
railway login
railway init
railway up

# Render
render deploy

# Fly.io
fly launch
fly deploy
```

---

## 5. CI/CD Pipeline

### GitHub Actions

**.github/workflows/deploy.yml:**
```yaml
name: Deploy

on:
  push:
    branches: [main, production]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build packages
        run: pnpm -r build
      
      - name: Run linter
        run: pnpm lint
      
      - name: Run tests
        run: pnpm test
  
  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=semver,pattern={{version}}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
  
  deploy-production:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://api.yourdomain.com
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Kubernetes
        uses: azure/k8s-deploy@v4
        with:
          manifests: |
            k8s/deployment.yaml
            k8s/service.yaml
            k8s/ingress.yaml
          images: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          kubectl-version: 'latest'
```

---

## 6. Environment Configuration

### Управление переменными окружения

**.env.example:**
```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# OpenTelemetry
OTEL_SERVICE_NAME=tsdev-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Database (если используется)
DATABASE_URL=postgresql://user:pass@localhost:5432/db
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis (для distributed caching)
REDIS_URL=redis://localhost:6379
REDIS_TTL=3600

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
DATADOG_API_KEY=your-datadog-key
```

### Config loader

**src/config.ts:**
```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3000),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  otel: z.object({
    serviceName: z.string().default('tsdev-api'),
    endpoint: z.string().optional(),
    samplerRatio: z.coerce.number().min(0).max(1).default(1),
  }),
  
  rateLimit: z.object({
    windowMs: z.coerce.number().default(60000),
    maxRequests: z.coerce.number().default(100),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    
    otel: {
      serviceName: process.env.OTEL_SERVICE_NAME,
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      samplerRatio: process.env.OTEL_TRACES_SAMPLER_ARG,
    },
    
    rateLimit: {
      windowMs: process.env.RATE_LIMIT_WINDOW_MS,
      maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
    },
  });
}
```

---

## 7. Production Checklist

### Перед развертыванием

- [ ] **Build проходит без ошибок**
  ```bash
  pnpm -r build
  ```

- [ ] **Linter проходит**
  ```bash
  pnpm lint
  ```

- [ ] **Tests проходят**
  ```bash
  pnpm test
  ```

- [ ] **Health check endpoint реализован**
  ```typescript
  // src/health.ts
  export function createHealthCheck(registry: Registry) {
    return async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
      procedures: registry.size,
      uptime: process.uptime(),
    });
  }
  ```

- [ ] **Graceful shutdown настроен**
  ```typescript
  // src/server.ts
  let server: Server;
  
  async function shutdown() {
    console.log('Shutting down gracefully...');
    
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
    
    // Force close after 10s
    setTimeout(() => {
      console.error('Forced shutdown');
      process.exit(1);
    }, 10000);
  }
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  ```

- [ ] **Logging настроен**
  ```bash
  npm install pino pino-pretty
  ```
  
  ```typescript
  import pino from 'pino';
  
  export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' 
      ? { target: 'pino-pretty' }
      : undefined,
  });
  ```

- [ ] **Error tracking (Sentry/Datadog)**
  ```typescript
  import * as Sentry from '@sentry/node';
  
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  }
  ```

- [ ] **Rate limiting настроен**
  ```typescript
  import { withRateLimit } from '@tsdev/policies';
  
  const handler = applyPolicies(
    baseHandler,
    withRateLimit({ maxTokens: 100, windowMs: 60000 })
  );
  ```

- [ ] **CORS настроен**
  ```typescript
  // В HTTP adapter
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  ```

- [ ] **Security headers**
  ```bash
  npm install helmet
  ```

- [ ] **OpenTelemetry сконфигурирован**

---

## 8. Monitoring & Observability

### Metrics (Prometheus)

**src/metrics.ts:**
```typescript
import { register, Counter, Histogram } from 'prom-client';

export const procedureCallsTotal = new Counter({
  name: 'tsdev_procedure_calls_total',
  help: 'Total procedure calls',
  labelNames: ['procedure', 'status'],
});

export const procedureDuration = new Histogram({
  name: 'tsdev_procedure_duration_seconds',
  help: 'Procedure execution duration',
  labelNames: ['procedure'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

// Expose metrics endpoint
export function getMetrics() {
  return register.metrics();
}
```

### Health Check

**src/health.ts:**
```typescript
export async function healthCheck(registry: Registry) {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    procedures: {
      total: registry.size,
      names: Array.from(registry.keys()),
    },
  };
}
```

---

## 9. Масштабирование

### Horizontal Scaling

**Stateless design:**
- Все процедуры должны быть stateless
- Используйте Redis для shared state
- Session в JWT или external store

**Load Balancing:**
```nginx
upstream tsdev_backend {
    least_conn;
    server api1:3000;
    server api2:3000;
    server api3:3000;
}

server {
    listen 80;
    
    location / {
        proxy_pass http://tsdev_backend;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Caching Strategy

```typescript
import { withCache } from '@tsdev/policies';

const handler = applyPolicies(
  baseHandler,
  withCache({ 
    ttl: 300, // 5 minutes
    keyGenerator: (input) => JSON.stringify(input),
  })
);
```

---

## Рекомендации по выбору платформы

| Сценарий | Платформа | Причина |
|----------|-----------|---------|
| **MVP/Prototype** | Railway, Render | Быстрый deploy, бесплатный tier |
| **Production API** | Kubernetes, Docker | Полный контроль, масштабируемость |
| **Serverless** | AWS Lambda, Vercel | Низкая стоимость при спорадической нагрузке |
| **Next.js + API** | Vercel | Оптимизирован для Next.js |
| **Enterprise** | Kubernetes + AWS/GCP | Compliance, control, scaling |

---

## Дополнительные ресурсы

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Kubernetes Patterns](https://kubernetes.io/docs/concepts/)
- [12 Factor App](https://12factor.net/)
- [OpenTelemetry Deployment](https://opentelemetry.io/docs/collector/deployment/)
