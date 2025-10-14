# 🚀 Установка Monorepo - Quick Start

## Предварительные требования

- Node.js 20+
- pnpm 8+

Установка pnpm:
```bash
npm install -g pnpm
```

## Установка

### 1. Установка всех зависимостей

```bash
# В корне монорепозитория
pnpm install
```

Эта команда:
- Устанавливает зависимости для всех packages
- Линкует `tsdev` пакет в examples
- Создает символические ссылки для workspace:* зависимостей

### 2. Проверка установки

```bash
# Проверить что workspace работает
pnpm list --depth 0

# Должно показать:
# nextjs-workflow-viz -> tsdev (workspace:*)
```

## Запуск Example

### Development режим

```bash
# Из корня
pnpm dev

# Или из директории примера
cd examples/nextjs-workflow-viz
pnpm dev
```

Откройте http://localhost:3000

### Production build

```bash
# Build всего monorepo
pnpm build

# Или только example
pnpm --filter nextjs-workflow-viz build

# Start production
cd examples/nextjs-workflow-viz
pnpm start
```

## Структура после установки

```
/workspace
├── node_modules/               # Shared dependencies
├── packages/
│   └── tsdev/
│       ├── node_modules/       # tsdev dependencies
│       └── ...
└── examples/
    └── nextjs-workflow-viz/
        ├── node_modules/
        │   └── tsdev -> ../../packages/tsdev  # Symlink!
        └── ...
```

## Импорты работают

После установки все импорты из `tsdev` будут работать:

```typescript
// ✅ Работает
import { executeWorkflow } from 'tsdev/core/workflow';
import { useWorkflow } from 'tsdev/core/workflow/react';
import type { Registry } from 'tsdev/core';
```

## Команды

### Корневые команды (из /)

```bash
pnpm dev          # Запустить example в dev режиме
pnpm build        # Build всех пакетов
pnpm lint         # Lint всех пакетов
pnpm lint:fix     # Lint + autofix
```

### Package-specific команды

```bash
# Только tsdev
pnpm --filter tsdev build
pnpm --filter tsdev lint

# Только example
pnpm --filter nextjs-workflow-viz dev
pnpm --filter nextjs-workflow-viz build
```

### Все пакеты рекурсивно

```bash
pnpm -r build     # Build всех
pnpm -r lint      # Lint всех
pnpm -r clean     # Clean всех
```

## Troubleshooting

### "Module not found: tsdev"

```bash
# Переустановить зависимости
rm -rf node_modules packages/*/node_modules examples/*/node_modules
pnpm install
```

### TypeScript ошибки

```bash
# Rebuild tsdev package
cd packages/tsdev
pnpm build

# Или из корня
pnpm --filter tsdev build
```

### Hot reload не работает

```bash
# Restart Next.js dev server
cd examples/nextjs-workflow-viz
pnpm dev
```

### Workspace не линкуется

Проверьте `pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
  - 'examples/*'
```

Проверьте зависимость в `examples/nextjs-workflow-viz/package.json`:
```json
{
  "dependencies": {
    "tsdev": "workspace:*"
  }
}
```

## Проверка что все работает

### 1. Запустить example
```bash
pnpm dev
```

### 2. Открыть http://localhost:3000

### 3. Проверить workflow execution
- Выбрать workflow из dropdown
- Нажать "Execute Workflow"
- Должна появиться визуализация с React Flow
- Должны собраться OTEL spans

### 4. Проверить imports
Откройте `examples/nextjs-workflow-viz/src/lib/workflow/runtime.ts`:
```typescript
import { executeWorkflow } from "tsdev/core/workflow"; // ✅ Должно работать
```

## Что делает pnpm install

1. **Анализирует workspace**
   - Читает `pnpm-workspace.yaml`
   - Находит все packages

2. **Устанавливает зависимости**
   - Общие зависимости в root `node_modules`
   - Специфичные для каждого package

3. **Линкует workspace packages**
   - `tsdev` становится доступен в examples
   - Создается symlink в `node_modules`

4. **Создает pnpm-lock.yaml**
   - Фиксирует версии всех зависимостей
   - Включая workspace:* линки

## Production Deployment

### Build для production

```bash
# 1. Build framework
pnpm --filter tsdev build

# 2. Build example
pnpm --filter nextjs-workflow-viz build

# 3. Start
cd examples/nextjs-workflow-viz
pnpm start
```

### Docker

```dockerfile
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages packages/
COPY examples examples/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build
RUN pnpm build

# Start
CMD ["pnpm", "--filter", "nextjs-workflow-viz", "start"]
```

## Итог

После `pnpm install`:
- ✅ Все зависимости установлены
- ✅ tsdev package линкован в example
- ✅ TypeScript видит типы из tsdev
- ✅ Hot reload работает
- ✅ Можно запускать `pnpm dev`

**Следующий шаг:** `pnpm dev` и откройте http://localhost:3000 🚀
