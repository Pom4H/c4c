# 🚀 Quick Start

## Установка

```bash
# 1. Установить pnpm (если нет)
npm install -g pnpm

# 2. Установить зависимости
pnpm install

# 3. Запустить example
pnpm dev
```

Откройте http://localhost:3000

## Импорты из tsdev

```typescript
// Workflow runtime
import { executeWorkflow, validateWorkflow } from 'tsdev/core/workflow';
import type { WorkflowDefinition, WorkflowExecutionResult } from 'tsdev/core/workflow';

// React hooks
import { useWorkflow, useWorkflows, useWorkflowDefinition } from 'tsdev/core/workflow/react';

// Core
import type { Registry, Procedure } from 'tsdev/core';
import { executeProcedure, createExecutionContext } from 'tsdev/core';

// Policies
import { withSpan, withRetry, withLogging } from 'tsdev/policies';
```

## React Hook Example

```typescript
'use client';

import { useWorkflow } from 'tsdev/core/workflow/react';

function MyComponent() {
  const { execute, result, isExecuting, error } = useWorkflow({
    onSuccess: (result) => console.log('Done!', result),
    onError: (err) => console.error('Failed:', err)
  });

  return (
    <button 
      onClick={() => execute('my-workflow-id')}
      disabled={isExecuting}
    >
      {isExecuting ? 'Executing...' : 'Run Workflow'}
    </button>
  );
}
```

## API Route Example

```typescript
// app/api/workflow/execute/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from 'tsdev/core/workflow';

export async function POST(request: NextRequest) {
  const { workflowId, input } = await request.json();
  const result = await executeWorkflow(workflow, registry, input);
  return NextResponse.json(result);
}
```

## Команды

```bash
# Development
pnpm dev              # Запустить example

# Build
pnpm build            # Build всех пакетов
pnpm -r build         # Build рекурсивно

# Lint
pnpm lint             # Lint
pnpm lint:fix         # Lint + fix

# Package-specific
pnpm --filter tsdev build
pnpm --filter nextjs-workflow-viz dev
```

## Структура

```
/workspace
├── packages/tsdev/           # Framework
│   ├── core/workflow/        # Workflow runtime + OTEL
│   │   └── react/            # React hooks
│   └── ...
└── examples/
    └── nextjs-workflow-viz/  # Example app
        ├── app/api/workflow/ # API routes
        └── src/lib/hooks/    # UI hooks
```

## Что дальше?

- 📖 [MONOREPO_INSTALL.md](./MONOREPO_INSTALL.md) - Полная инструкция
- 📚 [README.md](./README.md) - Документация фреймворка
- 🎯 [PHILOSOPHY.md](./PHILOSOPHY.md) - Философия

**Готово к использованию!** 🎉
