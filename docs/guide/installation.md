# Installation

Get c4c installed and running in your project.

## Prerequisites

- Node.js 18+ or 20+
- npm, pnpm, or yarn
- TypeScript 5+

## Create New Project

Start a new c4c project:

```bash
# Create directory
mkdir my-c4c-project
cd my-c4c-project

# Initialize package.json
pnpm init

# Install c4c packages
pnpm add @c4c/core @c4c/workflow zod
pnpm add -D @c4c/cli typescript @types/node

# Initialize TypeScript
pnpm tsc --init
```

### Package.json Setup

```json
{
  "name": "my-c4c-project",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "c4c dev",
    "serve": "c4c serve",
    "generate:client": "c4c generate client --out ./src/client.ts",
    "generate:openapi": "c4c generate openapi --out ./openapi.json"
  },
  "dependencies": {
    "@c4c/core": "^0.1.0",
    "@c4c/workflow": "^0.1.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@c4c/cli": "^0.1.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Add to Existing Project

Add c4c to an existing TypeScript project:

```bash
pnpm add @c4c/core @c4c/workflow zod
pnpm add -D @c4c/cli
```

Update package.json scripts:

```json
{
  "scripts": {
    "c4c:dev": "c4c dev",
    "c4c:serve": "c4c serve"
  }
}
```

## Project Structure

Create the basic structure:

```bash
mkdir -p src/procedures src/workflows
```

Your project structure:

```
my-c4c-project/
├── src/
│   ├── procedures/
│   │   └── users.ts
│   └── workflows/
│       └── onboarding.ts
├── package.json
├── tsconfig.json
└── README.md
```

## First Procedure

Create `src/procedures/users.ts`:

```typescript
import { z } from "zod";
import type { Procedure } from "@c4c/core";

export const createUser: Procedure = {
  contract: {
    input: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
  handler: async (input) => {
    return {
      id: crypto.randomUUID(),
      ...input,
    };
  },
};
```

## Start Development Server

```bash
pnpm dev
```

Server starts on `http://localhost:3000`

## Verify Installation

Test your setup:

```bash
# Execute procedure
pnpm c4c exec createUser --input '{"name":"Alice","email":"alice@example.com"}'

# List procedures
pnpm c4c list

# Generate OpenAPI spec
pnpm c4c generate openapi --out ./openapi.json
```

## Optional Packages

Install additional packages as needed:

### Policies

For authentication, retry, logging, etc.:

```bash
pnpm add @c4c/policies
```

### Generators

For OpenAPI and client generation:

```bash
pnpm add @c4c/generators
```

### Adapters

For HTTP adapters:

```bash
pnpm add @c4c/adapters
```

### React Hooks

For React integration:

```bash
pnpm add @c4c/workflow-react react
```

## Monorepo Setup

For monorepo projects with pnpm workspaces:

### Root package.json

```json
{
  "name": "my-monorepo",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter api dev",
    "build": "pnpm -r build"
  }
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### Package Structure

```
my-monorepo/
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   └── src/procedures/
│   └── shared/
│       └── package.json
├── apps/
│   └── api/
│       ├── package.json
│       └── src/procedures/
├── package.json
└── pnpm-workspace.yaml
```

### API Package

```json
{
  "name": "@my-app/api",
  "dependencies": {
    "@c4c/core": "^0.1.0",
    "@c4c/workflow": "^0.1.0",
    "@my-app/core": "workspace:*"
  },
  "scripts": {
    "dev": "c4c dev"
  }
}
```

## Docker Setup

### Dockerfile

```dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
CMD ["pnpm", "serve"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - C4C_PORT=3000
    volumes:
      - ./src:/app/src
```

Build and run:

```bash
docker-compose up
```

## Environment Setup

### Development

Create `.env.development`:

```bash
C4C_PORT=3000
C4C_HOST=localhost
NODE_ENV=development
LOG_LEVEL=debug
```

### Production

Create `.env.production`:

```bash
C4C_PORT=8080
C4C_HOST=0.0.0.0
NODE_ENV=production
LOG_LEVEL=info
```

Load environment variables:

```bash
# Development
export $(cat .env.development | xargs) && pnpm dev

# Production
export $(cat .env.production | xargs) && pnpm serve
```

## Editor Setup

### VSCode

Install recommended extensions:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### Settings

`.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

## Troubleshooting

### Module Resolution Issues

If you see "Cannot find module" errors:

```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### TypeScript Errors

Ensure TypeScript is configured correctly:

```bash
# Check TypeScript version
pnpm tsc --version

# Compile to verify
pnpm tsc --noEmit
```

### CLI Not Found

If `c4c` command is not found:

```bash
# Install globally
pnpm add -g @c4c/cli

# Or use via npx
npx c4c dev

# Or via package.json script
pnpm dev
```

## Next Steps

- [Quick Start Guide](/guide/quick-start)
- [Create Your First Procedure](/guide/procedures)
- [Build a Workflow](/guide/workflows)
- [Explore Examples](/examples/basic)
