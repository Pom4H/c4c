# 📦 Monorepo Setup - pnpm Workspaces

## Структура

```
/workspace
├── pnpm-workspace.yaml         # Workspace конфигурация
├── package.json                # Корневой package.json
├── packages/
│   └── tsdev/                  # 🎯 Framework package
│       ├── package.json        # tsdev package
│       ├── tsconfig.json       # TypeScript config
│       ├── index.ts            # Main entry
│       ├── core/
│       │   ├── workflow/       # Workflow module
│       │   │   ├── runtime.ts
│       │   │   ├── types.ts
│       │   │   └── react/      # React hooks
│       │   └── ...
│       ├── policies/
│       ├── adapters/
│       └── ...
└── examples/
    └── nextjs-workflow-viz/    # Example app
        ├── package.json        # Uses workspace:* для tsdev
        └── ...
```

## pnpm Workspace Configuration

### `pnpm-workspace.yaml`
```yaml
packages:
  - 'packages/*'
  - 'examples/*'
```

### Root `package.json`
```json
{
  "name": "tsdev-monorepo",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter nextjs-workflow-viz dev",
    "build": "pnpm -r build"
  }
}
```

### Framework Package (`packages/tsdev/package.json`)
```json
{
  "name": "tsdev",
  "version": "0.1.0",
  "type": "module",
  "main": "./index.js",
  "exports": {
    ".": "./index.js",
    "./core/workflow": "./core/workflow/index.js",
    "./core/workflow/react": "./core/workflow/react/index.js"
  }
}
```

### Example Package (`examples/nextjs-workflow-viz/package.json`)
```json
{
  "name": "nextjs-workflow-viz",
  "dependencies": {
    "tsdev": "workspace:*"
  }
}
```

## Использование

### В коде примера

**До:**
```typescript
import { executeWorkflow } from '../../../../../src/core/workflow/runtime.js';
```

**После:**
```typescript
import { executeWorkflow } from 'tsdev/core/workflow';
```

### Импорты из tsdev

```typescript
// Core workflow
import { executeWorkflow, WorkflowDefinition } from 'tsdev/core/workflow';

// React hooks
import { useWorkflow } from 'tsdev/core/workflow/react';

// Core types
import type { Registry, Procedure } from 'tsdev/core';

// Policies
import { withSpan, withRetry } from 'tsdev/policies';
```

## Установка

```bash
# В корне монорепо
pnpm install

# Запуск примера
pnpm dev

# Или
cd examples/nextjs-workflow-viz
pnpm dev
```

## Exports из tsdev

Package exports настроены для удобного импорта:

| Import Path | Файл |
|------------|------|
| `tsdev` | `packages/tsdev/index.ts` |
| `tsdev/core` | `packages/tsdev/core/index.ts` |
| `tsdev/core/workflow` | `packages/tsdev/core/workflow/index.ts` |
| `tsdev/core/workflow/react` | `packages/tsdev/core/workflow/react/index.ts` |
| `tsdev/policies` | `packages/tsdev/policies/index.ts` |

## TypeScript Configuration

`packages/tsdev/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "./dist"
  }
}
```

## Преимущества

### 1. Чистые Импорты
```typescript
// Вместо относительных путей
import { executeWorkflow } from '../../../../../src/core/workflow/runtime.js';

// Используем package imports
import { executeWorkflow } from 'tsdev/core/workflow';
```

### 2. Type Safety
- TypeScript резолвит типы через exports
- Полная поддержка autocomplete
- Declaration maps для source maps

### 3. Workspace Dependencies
```json
{
  "dependencies": {
    "tsdev": "workspace:*"
  }
}
```
- Автоматическая линковка локального пакета
- Нет необходимости в `npm link`
- Hot reload работает из коробки

### 4. Независимые Версии
- Каждый пакет имеет свою версию
- Можно публиковать отдельно
- Общие зависимости в корне

## Build & Development

### Development
```bash
# Все пакеты в dev режиме
pnpm -r dev

# Только пример
pnpm --filter nextjs-workflow-viz dev
```

### Build
```bash
# Build всех пакетов
pnpm -r build

# Build только tsdev
pnpm --filter tsdev build
```

### Lint
```bash
# Lint всего monorepo
pnpm -r lint

# Lint с автофиксом
pnpm -r lint:fix
```

## Публикация

Когда будете готовы опубликовать tsdev в npm:

```bash
cd packages/tsdev
pnpm build
npm publish
```

После публикации пример может использовать:
```json
{
  "dependencies": {
    "tsdev": "^0.1.0"
  }
}
```

## Troubleshooting

### Module not found
```bash
# Переустановить зависимости
rm -rf node_modules
pnpm install
```

### TypeScript errors
```bash
# Rebuild declarations
pnpm --filter tsdev build
```

### Hot reload не работает
```bash
# Restart dev server
pnpm dev
```

## Итог

✅ Чистая структура монорепозитория
✅ pnpm workspaces для быстрой установки
✅ workspace:* для локальных зависимостей
✅ Простые импорты вместо относительных путей
✅ TypeScript поддержка из коробки
✅ Готово к публикации в npm
