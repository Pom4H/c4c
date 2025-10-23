# Migration to Universal Introspection System

## 🎯 Что сделано

Полностью переработана система discovery артефактов - **убраны hardcoded пути**, реализована **универсальная интроспекция**.

## ✅ Основные изменения

### 1. Core Package (`packages/core/`)

**Новые функции:**
- `collectProjectArtifacts(rootPath)` - главная функция, сканирует весь проект
- `loadArtifactsFromModule(path)` - загружает procedures и workflows за один проход
- `isWorkflow(value)` - type guard для WorkflowDefinition

**Новые типы:**
- `WorkflowRegistry = Map<string, WorkflowDefinition>`
- `ProjectArtifacts = { procedures, workflows, moduleIndex }`

**Auto-naming:**
- `contract.name` теперь опциональное
- Если не указано → используется имя экспорта
- IDE refactoring работает полностью! 🎉

**Файлы:**
- ✅ `packages/core/src/types.ts` - `contract.name` теперь optional
- ✅ `packages/core/src/registry.ts` - добавлена интроспекция + auto-naming
- ✅ `packages/core/src/index.ts` - экспортированы новые типы

### 2. CLI Package (`apps/cli/`)

**Удалены hardcoded пути:**
- ✅ `src/lib/project-paths.ts` - упрощен, убраны `determineProceduresPath()` и `determineWorkflowsPath()`
- ✅ `src/lib/registry.ts` - переписан для работы с обоими типами артефактов
- ✅ `src/lib/watcher.ts` - новая функция `watchProject()` для отслеживания всего проекта
- ✅ `src/lib/formatting.ts` - добавлена `logWorkflowChange()`

**Обновлены команды:**
- ✅ `src/commands/serve.ts` - использует `collectProjectArtifacts()`
- ✅ `src/commands/exec.ts` - workflows по ID, не по файлу
- ✅ `src/lib/server.ts` - полностью переписан для новой системы
- ✅ `src/bin.ts` - обновлены описания и параметры

### 3. Примеры

Добавлены новые примеры:
- ✅ `examples/basic/procedures/auto-naming-demo.ts` - демо auto-naming
- ✅ `examples/basic/procedures/explicit-naming-demo.ts` - демо explicit naming

### 4. Документация

- ✅ `INTROSPECTION_SYSTEM.md` - полное описание новой системы
- ✅ `AUTO_NAMING.md` - auto-naming система и best practices
- ✅ `EXEC_UNIFIED_APPROACH.md` - унифицированная команда exec
- ✅ `MIGRATION_SUMMARY.md` - этот файл

---

## 📋 Как это работает

### До (hardcoded)

```typescript
// ❌ Жестко зашитые пути
const proceduresPath = join(root, "procedures");
const workflowsPath = join(root, "workflows");

// Можно только так:
project/
├── procedures/    ← Обязательно
└── workflows/     ← Обязательно
```

### После (introspection)

```typescript
// ✅ Сканирует весь проект
const artifacts = await collectProjectArtifacts(root);
// { procedures: Map, workflows: Map, moduleIndex: Map }

// Любая структура работает:
project/
└── src/
    ├── users.ts          ← Procedures здесь
    ├── flows.ts          ← Workflows здесь
    └── modules/
        └── orders/
            └── index.ts  ← Или здесь!
```

### Type Guards

```typescript
// Procedure = { contract, handler }
isProcedure(export) => boolean

// Workflow = { id, name, version, nodes, startNode }
isWorkflow(export) => boolean
```

**Единый проход** - читаем файл один раз, находим оба типа артефактов.

---

## 🚀 Использование

### CLI

```bash
# Просто укажите корень проекта (или используйте текущую директорию)
c4c serve --root .
c4c dev --root ./my-project

# Execute - унифицированная команда (приоритет: procedure > workflow)
c4c exec users.create --input '{"name":"Alice"}'
c4c exec simple-math-workflow --input '{}'

# JSON output для скриптов
c4c exec math.add --input '{"a":5,"b":3}' --json
```

### API

```typescript
import { collectProjectArtifacts } from '@c4c/core';

const artifacts = await collectProjectArtifacts('./my-project');

console.log(`Found ${artifacts.procedures.size} procedures`);
console.log(`Found ${artifacts.workflows.size} workflows`);

// Use them
const procedure = artifacts.procedures.get('users.create');
const workflow = artifacts.workflows.get('user-onboarding');
```

### Hot Reload

Теперь отслеживается **весь проект**:

```typescript
// Один watcher для всего
watchProject(projectRoot, moduleIndex, registry, workflowRegistry, signal);

// Обновляет procedures И workflows при изменении файлов
```

---

## 🔄 Backward Compatibility

### ✅ Старый код работает

```typescript
// Эта функция все еще работает!
import { collectRegistry } from '@c4c/core';
const registry = await collectRegistry('./procedures');
```

### ✅ Старая структура работает

```
project/
├── procedures/    ← Все еще найдет
└── workflows/     ← Все еще найдет
```

Но теперь можно использовать **любую структуру**!

---

## 📁 Поддерживаемые структуры

### 1. Convention (старый способ)

```
project/
├── procedures/
│   └── users.ts
└── workflows/
    └── onboarding.ts
```

### 2. Flat (простые проекты)

```
src/
├── handlers.ts
├── workflows.ts
└── utils.ts
```

### 3. Modular (рекомендуется)

```
src/
└── modules/
    ├── users/
    │   ├── procedures.ts
    │   └── workflows.ts
    ├── products/
    │   └── index.ts
    └── orders/
        └── handlers.ts
```

### 4. Domain-Driven Design

```
domains/
├── billing/
│   ├── commands/
│   └── flows/
└── auth/
    ├── commands/
    └── flows/
```

### 5. Monorepo

```
packages/
├── core/procedures/
├── integrations/stripe/
└── workflows/automation/
```

**Все работает автоматически!**

---

## 🎓 Что нужно знать

### Naming

**Procedures:** используют `contract.name` (опционально - можно использовать auto-naming)

```typescript
// Auto-naming (рекомендуется)
export const createUser: Procedure = {
  contract: { 
    input: ..., 
    output: ... 
  },  // name = "createUser"
  handler: ...
}

// Explicit naming (для public API)
export const createUser: Procedure = {
  contract: { 
    name: "users.create",  // ← Явное имя
    input: ..., 
    output: ... 
  },
  handler: ...
}
```

**Workflows:** используют `id`
```typescript
export const userOnboarding: WorkflowDefinition = {
  id: "user-onboarding",
  name: "User Onboarding",
  ...
}
```

📖 **Подробнее:** [AUTO_NAMING.md](./AUTO_NAMING.md)

### Ignored Files

Автоматически игнорируются:
- `node_modules/`
- `.git/`
- `dist/`, `build/`
- `*.test.ts`, `*.spec.ts`
- `*.d.ts`

### Logging

```
[Procedure] + users.create [external] [auth] @src/users.ts
[Workflow] + user-onboarding v1.0.0 (5 nodes) @src/workflows.ts
```

Символы:
- `+` = Registered (новый)
- `~` = Updated (обновлен)
- `-` = Removed (удален)

---

## 🔮 Будущее: Prune Command

```bash
# Генерация pre-bundled entry point для production
c4c prune --out ./dist/entry.js

# Zero introspection overhead в production
import { procedures, workflows } from './dist/entry.js';
createHttpServer(procedures, 3000);
```

Это оптимизация для production - не нужно сканировать файлы каждый раз.

---

## 🧪 Тестирование

После изменений проверьте:

1. **Basic example:**
```bash
cd examples/basic
pnpm dev
# Должны найтись все procedures и workflows
```

2. **Modules example:**
```bash
cd examples/modules
pnpm dev
# Должна найтись модульная структура
```

3. **Hot reload:**
```bash
c4c dev --root .
# Измените любой файл - должна сработать перезагрузка
```

4. **Execute:**
```bash
# Автоматически определяет тип (приоритет: procedure > workflow)
c4c exec math.add --input '{"a":5,"b":3}'
c4c exec simple-math-workflow
```

---

## 📝 Итого

### Удалено
- ❌ Hardcoded пути `procedures/` и `workflows/`
- ❌ Отдельные функции для procedures и workflows
- ❌ Необходимость конфигурации для кастомных путей
- ❌ Обязательное указание `contract.name`

### Добавлено
- ✅ Universal introspection - весь проект
- ✅ Type guards для определения артефактов
- ✅ Единый проход для procedures и workflows
- ✅ Поддержка любых структур папок
- ✅ Hot reload для всего проекта
- ✅ **Auto-naming** - `contract.name` опциональное
- ✅ IDE refactoring полностью работает

### Осталось
- ✅ Backward compatibility (100%)
- ✅ Все старые примеры работают
- ✅ Логирование улучшено
- ✅ Генераторы API работают с auto-naming

---

## 🎉 Результат

**Framework больше не диктует архитектуру!**

Организуйте код как хотите - c4c найдет ваши procedures и workflows через интроспекцию.

**Zero configuration. Maximum flexibility.**
