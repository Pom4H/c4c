# Universal Introspection System

## Что изменилось

### ❌ До: Hardcoded пути

```typescript
// Жестко зашитые пути
determineProceduresPath(root) => join(root, "procedures")
determineWorkflowsPath(root) => join(root, "workflows")

// Проблемы:
// - Навязывает одну структуру
// - Не работает с произвольной организацией
// - Требует конфигурацию для кастомных путей
```

### ✅ После: Pure Introspection

```typescript
// Сканирует весь проект!
collectProjectArtifacts(projectRoot) => {
  procedures: Map<string, Procedure>,
  workflows: Map<string, WorkflowDefinition>,
  moduleIndex: Map<...>
}

// Преимущества:
// ✅ Любая структура папок
// ✅ Нет конфигурации
// ✅ Единый проход по файлам
// ✅ Procedures и workflows вместе
```

---

## Как это работает

### 1. Type Guards

Система определяет артефакты по их **shape** (структуре), а не по расположению:

```typescript
// Procedure = объект с contract и handler
function isProcedure(value: unknown): value is Procedure {
  return (
    typeof value === "object" &&
    value !== null &&
    "contract" in value &&
    "handler" in value &&
    typeof (value as { handler: unknown }).handler === "function"
  );
}

// Workflow = объект с id, name, version, nodes, startNode
function isWorkflow(value: unknown): value is WorkflowDefinition {
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.version === "string" &&
    Array.isArray(obj.nodes) &&
    typeof obj.startNode === "string" &&
    !isProcedure(value)
  );
}
```

### 2. Единый проход

Один раз читаем файл → находим все экспорты → проверяем каждый:

```typescript
async function loadArtifactsFromModule(modulePath: string) {
  const imported = await import(specifier);
  const procedures = new Map();
  const workflows = new Map();

  for (const [exportName, exportValue] of Object.entries(imported)) {
    if (isProcedure(exportValue)) {
      procedures.set(exportValue.contract.name, exportValue);
    } else if (isWorkflow(exportValue)) {
      workflows.set(exportValue.id, exportValue);
    }
  }

  return { procedures, workflows };
}
```

### 3. Полное сканирование проекта

```typescript
async function collectProjectArtifacts(rootPath: string) {
  const allFiles = await findAllSupportedFiles(rootPath);
  
  for (const file of allFiles) {
    const artifacts = await loadArtifactsFromModule(file);
    // Собираем все procedures и workflows
  }
  
  return { procedures, workflows, moduleIndex };
}
```

**Игнорируем:**
- `node_modules/`
- `.git/`
- `dist/`, `build/`
- `*.test.ts`, `*.spec.ts`
- `*.d.ts`

---

## Поддерживаемые структуры

### 1. Flat (простые проекты)

```
src/
├── handlers.ts      // export const createUser: Procedure
├── workflows.ts     // export const onboarding: WorkflowDefinition
└── utils.ts
```

### 2. Modular (рекомендуется)

```
src/
└── modules/
    ├── users/
    │   ├── procedures.ts     // Все procedures модуля
    │   └── workflows.ts      // Все workflows модуля
    ├── products/
    │   ├── create.ts         // export const createProduct
    │   └── import.ts         // export const importWorkflow
    └── orders/
        └── index.ts          // Можно все в одном файле
```

### 3. Domain-Driven Design

```
domains/
├── billing/
│   ├── commands/
│   │   └── charge.ts        // export const chargePayment
│   └── flows/
│       └── subscription.ts   // export const renewSubscription
└── auth/
    ├── commands/
    │   └── login.ts
    └── flows/
        └── reset.ts
```

### 4. Monorepo

```
packages/
├── core/
│   └── procedures/
│       └── validation.ts     // export const validate
├── integrations/
│   ├── stripe/
│   │   └── charge.ts         // export const stripeCharge
│   └── sendgrid/
│       └── send.ts           // export const sendEmail
└── workflows/
    └── automation/
        └── onboarding.ts     // export const userOnboarding
```

### 5. Microservices

```
services/
├── orders/
│   └── src/
│       ├── api.ts           // REST handlers
│       ├── procedures.ts    // Business logic
│       └── workflows.ts     // Orchestration
└── inventory/
    └── src/
        ├── procedures.ts
        └── workflows.ts
```

**Все работает из коробки!** Никакой конфигурации.

---

## CLI изменения

### До

```bash
# Hardcoded пути
c4c serve --procedures ./procedures --workflows ./workflows

# Нужно указывать пути явно
c4c serve --procedures ./src/handlers --workflows ./src/flows

# Execute требовал разных команд
c4c exec-procedure users.create
c4c exec-workflow user-onboarding
```

### После

```bash
# Просто указываем корень проекта
c4c serve --root .

# Или даже без флагов (использует process.cwd())
c4c serve

# Сканирует весь проект, находит все артефакты

# Execute - унифицированная команда (приоритет: procedure > workflow)
c4c exec users.create --input '{"name":"Alice"}'
c4c exec simple-math-workflow --input '{}'
```

### Примеры

```bash
# Dev mode с hot reload
c4c dev --root ./my-project

# Execute - автоматически определяет тип (приоритет: procedure > workflow)
c4c exec users.create --input '{"name":"Alice","email":"alice@example.com"}'

# Execute workflow (если нет procedure с таким же именем)
c4c exec simple-math-workflow --input '{}'

# Input можно передать из файла
c4c exec users.create --input-file ./data.json

# JSON output (для скриптов)
c4c exec math.add --input '{"a":5,"b":3}' --json
```

---

## Hot Reload

Система отслеживает **весь проект**, а не только `procedures/`:

```typescript
// Один watcher для всего
watchProject(projectRoot, moduleIndex, registry, workflowRegistry, signal);

// При изменении файла:
// 1. Проверяем что это поддерживаемый файл (.ts, .js)
// 2. Перезагружаем модуль
// 3. Обновляем procedures И workflows из этого модуля
// 4. Логируем изменения

// Пример вывода:
// [Procedure] ~ users.create [external] [auth] @src/modules/users/create.ts
// [Workflow] + user-onboarding v1.0.0 (5 nodes) @src/modules/users/workflows.ts
```

---

## Логирование

### Procedures

```
[Procedure] + users.create [external] [auth] roles=api-endpoint,workflow-node | cat=users | auth=Bearer @src/users.ts
```

### Workflows

```
[Workflow] + simple-math-workflow "Basic math operations" v1.0.0 (3 nodes) @examples/basic/workflows/math.ts
[Workflow] ~ user-onboarding v1.2.0 (7 nodes) [triggered] @src/workflows/onboarding.ts
```

Легенда:
- `+` = Registered (новый артефакт)
- `~` = Updated (обновлен)
- `-` = Removed (удален)

---

## API изменения

### Core package

```typescript
import { 
  collectProjectArtifacts,    // Новое! Главная функция
  type WorkflowRegistry,       // Новое! Map<id, WorkflowDefinition>
  type ProjectArtifacts,       // Новое! { procedures, workflows, moduleIndex }
} from '@c4c/core';

// Использование
const artifacts = await collectProjectArtifacts('./my-project');

console.log(artifacts.procedures.size);  // 42 procedures
console.log(artifacts.workflows.size);   // 15 workflows

// Выполнение
const result = await executeProcedure(
  artifacts.procedures.get('users.create'),
  input,
  context
);

const workflowResult = await executeWorkflow(
  artifacts.workflows.get('user-onboarding'),
  artifacts.procedures,
  input
);
```

### Legacy API (backward compatible)

```typescript
// Старые функции все еще работают!
import { collectRegistry } from '@c4c/core';

// Сканирует указанную директорию
const registry = await collectRegistry('./procedures');
```

---

## Миграция

### Не требуется! 🎉

Ваш существующий код **продолжит работать**:

```
project/
├── procedures/     ← Все еще работает
│   └── users.ts
└── workflows/      ← Все еще работает
    └── onboarding.ts
```

### Но теперь можно делать так:

```
project/
└── src/
    ├── users.ts       ← Procedures здесь
    ├── products.ts    ← И здесь
    ├── flows.ts       ← Workflows здесь
    └── modules/
        └── orders/
            └── index.ts  ← И здесь тоже!
```

---

## Performance

### Оптимизации

1. **Единый проход** - читаем каждый файл один раз
2. **Параллельная загрузка** - можно добавить `Promise.all()` в будущем
3. **Кеширование** - TypeScript loader кеширует модули
4. **Умная фильтрация** - пропускаем node_modules, tests, .d.ts

### Hot Reload

- **Инкрементальный** - перезагружаем только измененные файлы
- **Точные обновления** - знаем какие артефакты в каком файле
- **Быстрый** - обычно < 100ms на перезагрузку одного файла

---

## Будущее: Prune команда

```bash
# Генерирует точку входа со всеми импортами
c4c prune --out ./dist/entry.js

# Результат:
# dist/entry.js - готовый bundle, не нужно сканировать файлы
# Все procedures и workflows уже импортированы
```

```typescript
// dist/entry.js (сгенерировано)
import { createUser } from '../src/users.ts';
import { createProduct } from '../src/products.ts';
import { userOnboarding } from '../src/workflows.ts';

export const procedures = new Map([
  ['users.create', createUser],
  ['products.create', createProduct],
]);

export const workflows = new Map([
  ['user-onboarding', userOnboarding],
]);

// Запуск в production - zero introspection overhead
import { procedures, workflows } from './dist/entry.js';
createHttpServer(procedures, 3000);
```

---

## FAQ

### Q: Как определить, что файл содержит procedure?

**A:** По структуре экспорта. Если экспорт имеет `contract` и `handler`, это procedure.

### Q: Можно ли смешивать procedures и workflows в одном файле?

**A:** Да! Система найдет оба типа артефактов.

```typescript
// src/users.ts
export const createUser: Procedure = { ... };
export const userOnboarding: WorkflowDefinition = { ... };
```

### Q: Как избежать конфликтов имен?

**A:** 
- Procedures используют уникальное поле `contract.name`
- Workflows используют уникальное поле `id`
- При дубликатах в registry выводится warning
- **Команда `exec`:** если procedure и workflow имеют одинаковое имя/id, **procedure имеет приоритет**

Пример:
```typescript
// Procedure
export const test: Procedure = {
  contract: { name: "test", ... },  // ← Будет выполнена через exec
  ...
}

// Workflow
export const testWorkflow: WorkflowDefinition = {
  id: "test",  // ← Игнорируется если есть procedure с именем "test"
  ...
}

// c4c exec test → выполнит procedure, не workflow
```

### Q: Что если я хочу исключить некоторые файлы?

**A:** Используйте стандартные паттерны:
- `*.test.ts` - уже игнорируются
- `__tests__/` - будет добавлено
- Можно добавить свои паттерны в `IGNORED_DIRECTORIES`

### Q: Работает ли это с JavaScript?

**A:** Да! Поддерживаются `.js`, `.mjs`, `.cjs`, `.ts`, `.tsx`

### Q: Как это влияет на production?

**A:** 
- В dev mode: полное сканирование при старте + hot reload
- В production: используйте `c4c prune` для pre-bundled entry point (будущее)

---

## Примеры из real-world

### Example: basic

```
examples/basic/
├── procedures/
│   ├── data.ts          ← export const dataStatic, dataSecure, ...
│   ├── long.ts          ← export const waitSeconds
│   └── math.ts          ← export const add, subtract, multiply, divide
└── workflows/
    ├── long.ts          ← export const longRunningWorkflow
    └── math.ts          ← export const simpleMathWorkflow
```

Запуск:
```bash
cd examples/basic
c4c dev

# Output:
# [Procedure] + data.static [external] @procedures/data.ts
# [Procedure] + data.secure [external] [auth] @procedures/data.ts
# [Procedure] + math.add [external] @procedures/math.ts
# [Procedure] + math.subtract [external] @procedures/math.ts
# ...
# [Workflow] + simple-math-workflow v1.0.0 (3 nodes) @workflows/math.ts
# [Workflow] + long-running-workflow v1.0.0 (4 nodes) @workflows/long.ts
```

### Example: modules

```
examples/modules/
└── procedures/
    ├── analytics/
    │   └── track.ts         ← export const trackEvent
    ├── products/
    │   ├── create.ts        ← export const createProduct
    │   └── list.ts          ← export const listProducts
    └── users/
        ├── authenticate.ts   ← export const authenticate
        ├── create.ts         ← export const createUser
        └── get.ts            ← export const getUser
```

Все найдется автоматически! 🎉

---

## Итого

✅ **Удалены hardcoded пути**
✅ **Universal introspection**
✅ **Поддержка любых структур**
✅ **Единый проход для procedures и workflows**
✅ **Hot reload работает для всего проекта**
✅ **Backward compatible**
✅ **Zero configuration**

**Философия:** Framework не должен диктовать архитектуру. Ты организуешь код как хочешь — мы найдем артефакты.
