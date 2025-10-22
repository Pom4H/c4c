# Организация папок и универсальный DX

## Текущая ситуация

### Жесткая привязка к директориям

Сейчас в коде есть жесткая привязка к конкретным именам директорий:

```typescript
// apps/cli/src/lib/project-paths.ts
export function determineProceduresPath(root: string): string {
  return join(root, "procedures");  // ❌ Жесткая привязка
}

export function determineWorkflowsPath(root: string): string {
  return join(root, "workflows");   // ❌ Жесткая привязка
}
```

### Проблемы текущего подхода

1. **Навязывает одну архитектуру**: все должны использовать `procedures/` и `workflows/`
2. **Не гибко**: нельзя организовать код по модулям, доменам, микросервисам
3. **Ограничивает монорепы**: в монорепе может быть несколько проектов с разными структурами
4. **Противоречит философии**: c4c позиционируется как "code for coders", но ограничивает выбор архитектуры

### Что уже работает хорошо ✅

**Интроспекция на основе контрактов уже реализована!**

```typescript
// packages/core/src/registry.ts
function isProcedure(value: unknown): value is Procedure {
  return (
    typeof value === "object" &&
    value !== null &&
    "contract" in value &&
    "handler" in value &&
    typeof (value as { handler: unknown }).handler === "function"
  );
}
```

Система уже умеет:
- ✅ Проходить по всем экспортам модуля
- ✅ Проверять наличие контракта и handler
- ✅ Динамически загружать procedures из любых файлов
- ✅ Работать с TypeScript и JavaScript

**Проблема только в том, что мы ищем файлы только в фиксированных директориях!**

---

## Решение: Интроспекция вместо конвенций

### Идея

**Сканировать любые директории, которые указал пользователь, и находить procedures/workflows через интроспекцию экспортов.**

### Принципы

1. **Convention over configuration, но не навязывание**
   - По умолчанию ищем в `procedures/` и `workflows/` (обратная совместимость)
   - Но позволяем явно указать любые директории
   - Поддерживаем несколько директорий одновременно

2. **Интроспекция как основа discovery**
   - Не важно где лежит файл, важен его контракт
   - Procedure = любой экспорт с полями `contract` и `handler`
   - Workflow = любой экспорт, соответствующий `WorkflowDefinition`

3. **Поддержка любых архитектур**
   - Модульная структура (`modules/users/`, `modules/products/`)
   - Доменная (`domains/billing/`, `domains/auth/`)
   - Монорепозиторий (`apps/api/`, `packages/shared/`)
   - Микросервисы (`services/orders/`, `services/inventory/`)

### Реализация

#### 1. Конфигурация через файл (опционально)

```json
// c4c.config.json
{
  "procedures": {
    "paths": [
      "procedures",           // Convention: по умолчанию
      "src/modules/*/procedures",  // Модульная структура
      "src/domains/*/handlers"     // Доменная структура
    ],
    "exclude": [
      "**/*.test.ts",
      "**/__tests__/**"
    ]
  },
  "workflows": {
    "paths": [
      "workflows",
      "src/modules/*/workflows",
      "src/automation"
    ]
  }
}
```

#### 2. CLI флаги для override

```bash
# Указать кастомные директории
c4c serve --procedures src/handlers --procedures src/integrations

# Сканировать всю директорию src
c4c serve --scan src

# Использовать конфиг
c4c serve --config ./custom-config.json
```

#### 3. Обновить логику discovery

```typescript
// apps/cli/src/lib/project-paths.ts

import { glob } from 'glob';
import { readFileSync, existsSync } from 'node:fs';

interface ProjectConfig {
  procedures?: {
    paths?: string[];
    exclude?: string[];
  };
  workflows?: {
    paths?: string[];
    exclude?: string[];
  };
}

const DEFAULT_CONFIG: ProjectConfig = {
  procedures: {
    paths: ["procedures"],
    exclude: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"]
  },
  workflows: {
    paths: ["workflows"],
    exclude: ["**/*.test.ts", "**/*.spec.ts"]
  }
};

export function loadProjectConfig(root: string): ProjectConfig {
  const configPath = join(root, "c4c.config.json");
  
  if (existsSync(configPath)) {
    const configContent = readFileSync(configPath, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(configContent) };
  }
  
  return DEFAULT_CONFIG;
}

export function determineProceduresPaths(
  root: string, 
  cliPaths?: string[]
): string[] {
  // CLI флаги имеют приоритет
  if (cliPaths && cliPaths.length > 0) {
    return cliPaths.map(p => isAbsolute(p) ? p : join(root, p));
  }
  
  // Загружаем конфиг
  const config = loadProjectConfig(root);
  const patterns = config.procedures?.paths ?? ["procedures"];
  
  // Разворачиваем glob patterns
  const directories: string[] = [];
  for (const pattern of patterns) {
    const matches = glob.sync(pattern, {
      cwd: root,
      absolute: true,
      onlyDirectories: true,
    });
    directories.push(...matches);
  }
  
  return directories.length > 0 ? directories : [join(root, "procedures")];
}
```

#### 4. Обновить collectRegistry

```typescript
// packages/core/src/registry.ts

export async function collectRegistryFromPaths(
  proceduresPaths: string[]
): Promise<Registry> {
  const registry: Registry = new Map();
  
  for (const proceduresPath of proceduresPaths) {
    const pathRegistry = await collectRegistry(proceduresPath);
    
    // Merge registries with conflict detection
    for (const [name, procedure] of pathRegistry.entries()) {
      if (registry.has(name)) {
        console.warn(
          `[Registry] Duplicate procedure "${name}" found in ${proceduresPath}. ` +
          `Previous definition will be overwritten.`
        );
      }
      registry.set(name, procedure);
    }
  }
  
  return registry;
}
```

---

## Примеры архитектур

### 1. Convention (текущий подход - работает по умолчанию)

```
project/
├── procedures/
│   ├── users.ts
│   ├── emails.ts
│   └── payments.ts
└── workflows/
    ├── user-onboarding.ts
    └── payment-flow.ts
```

**Конфиг**: не нужен, работает из коробки

---

### 2. Модульная структура

```
project/
├── modules/
│   ├── users/
│   │   ├── procedures/
│   │   │   ├── create.ts
│   │   │   └── authenticate.ts
│   │   └── workflows/
│   │       └── onboarding.ts
│   ├── products/
│   │   ├── procedures/
│   │   │   ├── list.ts
│   │   │   └── search.ts
│   │   └── workflows/
│   │       └── import.ts
│   └── orders/
│       ├── procedures/
│       │   └── process.ts
│       └── workflows/
│           └── fulfillment.ts
└── c4c.config.json
```

**Конфиг**:
```json
{
  "procedures": {
    "paths": ["modules/*/procedures"]
  },
  "workflows": {
    "paths": ["modules/*/workflows"]
  }
}
```

**Преимущества**:
- ✅ Модули изолированы
- ✅ Легко находить связанный код
- ✅ Можно включать/выключать модули
- ✅ Естественная граница для микросервисов

---

### 3. Domain-Driven Design

```
project/
├── domains/
│   ├── billing/
│   │   ├── handlers/      # Вместо procedures
│   │   │   ├── charge.ts
│   │   │   └── refund.ts
│   │   └── automation/    # Вместо workflows
│   │       └── subscription-renewal.ts
│   ├── authentication/
│   │   ├── handlers/
│   │   │   ├── login.ts
│   │   │   └── refresh.ts
│   │   └── automation/
│   │       └── password-reset.ts
│   └── inventory/
│       ├── handlers/
│       │   └── stock-check.ts
│       └── automation/
│           └── restock-alert.ts
└── c4c.config.json
```

**Конфиг**:
```json
{
  "procedures": {
    "paths": ["domains/*/handlers"]
  },
  "workflows": {
    "paths": ["domains/*/automation"]
  }
}
```

**Преимущества**:
- ✅ Явная доменная модель
- ✅ Bounded contexts
- ✅ Легко выделить в микросервисы
- ✅ Терминология соответствует бизнесу

---

### 4. Монорепозиторий

```
monorepo/
├── apps/
│   ├── api/
│   │   └── procedures/
│   │       ├── public/
│   │       │   └── auth.ts
│   │       └── internal/
│   │           └── metrics.ts
│   └── admin/
│       └── procedures/
│           └── dashboard.ts
├── packages/
│   ├── shared-procedures/
│   │   ├── validation.ts
│   │   └── formatting.ts
│   └── integrations/
│       ├── stripe/
│       │   └── procedures/
│       │       └── charge.ts
│       └── sendgrid/
│           └── procedures/
│               └── send-email.ts
└── c4c.config.json
```

**Конфиг**:
```json
{
  "procedures": {
    "paths": [
      "apps/*/procedures",
      "packages/shared-procedures",
      "packages/integrations/*/procedures"
    ]
  }
}
```

**Преимущества**:
- ✅ Переиспользование кода
- ✅ Центральные shared utilities
- ✅ Изолированные приложения
- ✅ Независимое версионирование

---

### 5. Микросервисная архитектура

```
services/
├── orders/
│   ├── src/
│   │   ├── api/           # HTTP handlers
│   │   ├── procedures/    # Business logic
│   │   └── workflows/     # Orchestration
│   └── c4c.config.json
├── inventory/
│   ├── src/
│   │   ├── procedures/
│   │   └── workflows/
│   └── c4c.config.json
└── notifications/
    ├── src/
    │   ├── procedures/
    │   └── workflows/
    └── c4c.config.json
```

**Каждый сервис имеет свой конфиг**:
```json
// services/orders/c4c.config.json
{
  "procedures": {
    "paths": ["src/procedures"]
  },
  "workflows": {
    "paths": ["src/workflows"]
  }
}
```

**Преимущества**:
- ✅ Независимое развертывание
- ✅ Изолированные зависимости
- ✅ Четкие границы сервисов
- ✅ Легко масштабировать

---

### 6. Flat structure (простые проекты)

```
project/
├── src/
│   ├── handlers.ts       # Все procedures в одном файле
│   └── automations.ts    # Все workflows в одном файле
└── c4c.config.json
```

**Конфиг**:
```json
{
  "procedures": {
    "paths": ["src"]  // Сканируем всю директорию src
  },
  "workflows": {
    "paths": ["src"]
  }
}
```

**CLI**:
```bash
# Или через флаг
c4c serve --scan src
```

**Преимущества**:
- ✅ Минимум файлов для маленьких проектов
- ✅ Не нужно думать о структуре
- ✅ Быстрый старт

---

## Рекомендуемая архитектура (best practice)

### Для новых проектов: Модульная структура

**Почему?**

1. **Масштабируемость**: легко добавлять новые модули
2. **Изоляция**: каждый модуль самодостаточен
3. **Тестирование**: легко тестировать модули изолированно
4. **Refactoring**: легко выделить модуль в отдельный пакет/сервис
5. **Team work**: разные команды работают над разными модулями

### Структура

```
project/
├── src/
│   └── modules/
│       ├── users/
│       │   ├── procedures/
│       │   │   ├── create.ts
│       │   │   ├── authenticate.ts
│       │   │   ├── update.ts
│       │   │   └── delete.ts
│       │   ├── workflows/
│       │   │   ├── onboarding.ts
│       │   │   └── offboarding.ts
│       │   ├── types.ts         # Shared types
│       │   └── README.md
│       │
│       ├── products/
│       │   ├── procedures/
│       │   │   ├── list.ts
│       │   │   ├── search.ts
│       │   │   ├── create.ts
│       │   │   └── update.ts
│       │   ├── workflows/
│       │   │   └── import.ts
│       │   └── types.ts
│       │
│       └── orders/
│           ├── procedures/
│           │   ├── create.ts
│           │   ├── process.ts
│           │   └── cancel.ts
│           ├── workflows/
│           │   ├── fulfillment.ts
│           │   └── refund.ts
│           └── types.ts
│
├── c4c.config.json
└── package.json
```

### Конфиг

```json
{
  "procedures": {
    "paths": ["src/modules/*/procedures"],
    "exclude": ["**/*.test.ts", "**/__tests__/**"]
  },
  "workflows": {
    "paths": ["src/modules/*/workflows"],
    "exclude": ["**/*.test.ts"]
  }
}
```

### Naming conventions

**Procedures**: `<resource>.<action>`
```typescript
// modules/users/procedures/create.ts
export const createUser: Procedure = {
  contract: {
    name: "users.create",  // ✅
    // ...
  }
}

// modules/products/procedures/search.ts
export const searchProducts: Procedure = {
  contract: {
    name: "products.search",  // ✅
    // ...
  }
}
```

**Workflows**: `<module>-<action>`
```typescript
// modules/users/workflows/onboarding.ts
export const userOnboarding: WorkflowDefinition = {
  id: "users-onboarding",  // ✅
  // ...
}
```

### Миграция модуля в микросервис

Легко выделить модуль в отдельный сервис:

```bash
# 1. Копируем модуль
cp -r src/modules/orders services/orders/src

# 2. Создаем package.json и c4c.config.json
cd services/orders
npm init -y

# 3. Обновляем конфиг
echo '{"procedures":{"paths":["src/procedures"]}}' > c4c.config.json

# 4. Запускаем как отдельный сервис
c4c serve --port 3001
```

---

## План миграции

### Фаза 1: Обратная совместимость (неделя 1)

1. Добавить поддержку `c4c.config.json`
2. Обновить `determineProceduresPaths()` для поддержки массива путей
3. Добавить CLI флаги `--procedures` и `--workflows`
4. **Сохранить поведение по умолчанию**: если конфига нет, использовать `procedures/` и `workflows/`

**Результат**: существующие проекты продолжают работать без изменений

### Фаза 2: Примеры разных архитектур (неделя 2)

1. Создать `examples/architecture/modular/`
2. Создать `examples/architecture/ddd/`
3. Создать `examples/architecture/monorepo/`
4. Обновить документацию

**Результат**: пользователи видят варианты и могут выбрать

### Фаза 3: Инструменты миграции (неделя 3)

1. CLI команда для генерации конфига: `c4c init --template modular`
2. CLI команда для миграции структуры: `c4c migrate --from convention --to modular`
3. Валидация конфига

**Результат**: легко начать новый проект или мигрировать существующий

### Фаза 4: Дополнительные фичи (будущее)

1. Поддержка exclude patterns в конфиге
2. Watch mode для нескольких директорий
3. Приоритеты директорий при конфликтах имен
4. Автоматическое определение структуры (AI-powered)

---

## Альтернативные подходы

### Вариант 1: Только конвенции (текущий подход)

**Плюсы**:
- ✅ Простота
- ✅ Предсказуемость
- ✅ Меньше кода

**Минусы**:
- ❌ Негибкость
- ❌ Навязывание архитектуры
- ❌ Не подходит для сложных проектов
- ❌ Не подходит для монорепов

**Вердикт**: Хорошо для простых проектов, но ограничивает рост

### Вариант 2: Только конфигурация (без конвенций)

```json
{
  "procedures": {
    "paths": ["path1", "path2"]  // Всегда требуется конфиг
  }
}
```

**Плюсы**:
- ✅ Полная гибкость

**Минусы**:
- ❌ Дополнительная работа при старте
- ❌ Нет "правильного" способа
- ❌ Хуже DX для простых проектов

**Вердикт**: Слишком сложно для новичков

### Вариант 3: Автоматическое определение (AI-powered)

Сканировать проект и автоматически находить procedures:

```typescript
// Автоматически находит все экспорты с контрактами
c4c serve --auto-discover
```

**Плюсы**:
- ✅ Нулевая конфигурация
- ✅ Работает с любой структурой

**Минусы**:
- ❌ Может найти лишнее
- ❌ Медленнее при большом проекте
- ❌ Непредсказуемо
- ❌ Сложная реализация

**Вердикт**: Интересная идея, но требует экспериментов

### Вариант 4: Convention + Configuration (рекомендуется)

**Гибрид**:
- По умолчанию: `procedures/` и `workflows/` (convention)
- Опционально: `c4c.config.json` или CLI флаги (configuration)
- Интроспекция работает везде

**Плюсы**:
- ✅ Простой старт (convention)
- ✅ Гибкость при росте (configuration)
- ✅ Обратная совместимость
- ✅ Масштабируемость

**Минусы**:
- Чуть больше кода

**Вердикт**: ⭐ Лучший баланс между простотой и гибкостью

---

## Выводы

### 1. Проблема реальная

Жесткая привязка к `procedures/` и `workflows/` ограничивает архитектурные решения и не соответствует философии "code for coders".

### 2. Решение простое

Интроспекция уже работает! Нужно только:
- Разрешить указывать несколько директорий
- Добавить опциональный конфиг
- Сохранить convention как default

### 3. Рекомендуемая архитектура

**Модульная структура** (`modules/*/procedures`) — лучший баланс:
- Легко начать
- Легко масштабировать
- Легко мигрировать в микросервисы
- Естественная организация кода

### 4. Реализация

1. **Фаза 1** (критично): Convention + Configuration
2. **Фаза 2** (важно): Примеры разных архитектур
3. **Фаза 3** (опционально): Инструменты миграции
4. **Фаза 4** (будущее): Advanced features

### 5. DX улучшается

- ✅ Свобода выбора архитектуры
- ✅ Обратная совместимость
- ✅ Простота для новичков
- ✅ Гибкость для профи
- ✅ Соответствие философии фреймворка

---

## Код для начала

### 1. Обновить types

```typescript
// apps/cli/src/lib/types.ts

export interface ProceduresConfig {
  paths?: string[];
  exclude?: string[];
}

export interface WorkflowsConfig {
  paths?: string[];
  exclude?: string[];
}

export interface ProjectConfig {
  procedures?: ProceduresConfig;
  workflows?: WorkflowsConfig;
}
```

### 2. Обновить project-paths.ts

```typescript
// apps/cli/src/lib/project-paths.ts

import { glob } from 'glob';

const DEFAULT_CONFIG: ProjectConfig = {
  procedures: { paths: ["procedures"] },
  workflows: { paths: ["workflows"] }
};

export function loadProjectConfig(root: string): ProjectConfig {
  const configPath = join(root, "c4c.config.json");
  if (existsSync(configPath)) {
    return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(configPath, 'utf-8')) };
  }
  return DEFAULT_CONFIG;
}

export function resolvePaths(
  root: string,
  patterns: string[],
  exclude: string[] = []
): string[] {
  const paths: string[] = [];
  
  for (const pattern of patterns) {
    const matches = glob.sync(pattern, {
      cwd: root,
      absolute: true,
      onlyDirectories: true,
      ignore: exclude
    });
    paths.push(...matches);
  }
  
  return paths.length > 0 ? paths : [join(root, "procedures")];
}
```

### 3. Обновить serve command

```typescript
// apps/cli/src/commands/serve.ts

interface ServeCommandOptions {
  port?: number;
  root?: string;
  procedures?: string[];  // Новое!
  workflows?: string[];   // Новое!
  config?: string;        // Новое!
}

export async function serveCommand(mode: string, options: ServeCommandOptions) {
  const rootDir = resolve(options.root ?? process.cwd());
  
  // Загружаем конфиг
  const config = loadProjectConfig(rootDir);
  
  // CLI флаги перекрывают конфиг
  const proceduresPaths = options.procedures 
    ? options.procedures.map(p => resolve(rootDir, p))
    : resolvePaths(rootDir, config.procedures?.paths ?? ["procedures"]);
    
  const workflowsPaths = options.workflows
    ? options.workflows.map(p => resolve(rootDir, p))
    : resolvePaths(rootDir, config.workflows?.paths ?? ["workflows"]);
  
  // ... остальная логика
}
```

Готово! Это даст универсальный DX без навязывания архитектуры! 🚀
