# Unified Exec Command

## Концепция

Одна команда `c4c exec <name>` для выполнения **любого** артефакта — procedure или workflow.

## Приоритет

```
1. Ищем procedure с именем <name>
   └─ Если найдена → выполняем как procedure
   
2. Ищем workflow с ID <name>
   └─ Если найден → выполняем как workflow
   
3. Ничего не найдено → показываем список доступных артефактов
```

**Процедуры имеют приоритет над workflows!**

---

## Примеры использования

### 1. Execute procedure

```bash
c4c exec users.create --input '{"name":"Alice","email":"alice@example.com"}'
```

**Что происходит:**
1. Сканирует проект → находит artifacts
2. Ищет procedure с именем `users.create`
3. Находит → выполняет
4. Выводит результат

### 2. Execute workflow

```bash
c4c exec simple-math-workflow --input '{"startValue":10}'
```

**Что происходит:**
1. Сканирует проект → находит artifacts
2. Ищет procedure с именем `simple-math-workflow` → не находит
3. Ищет workflow с ID `simple-math-workflow` → находит
4. Выполняет workflow
5. Выводит результат с метриками (execution time, nodes executed, etc.)

### 3. Конфликт имен

```typescript
// src/test.ts
export const test: Procedure = {
  contract: { name: "test", ... },
  handler: async () => ({ message: "I'm a procedure" })
};

// src/workflows.ts
export const testWorkflow: WorkflowDefinition = {
  id: "test",  // ← Такое же имя!
  ...
};
```

```bash
c4c exec test
# → Выполнится PROCEDURE, не workflow
# Output: { message: "I'm a procedure" }
```

**Если нужен workflow, переименуйте его ID:**
```typescript
export const testWorkflow: WorkflowDefinition = {
  id: "test-workflow",  // ← Уникальное имя
  ...
};
```

### 4. Input из файла

```bash
# data.json
{
  "name": "Alice",
  "email": "alice@example.com",
  "role": "admin"
}

# Execute
c4c exec users.create --input-file ./data.json
```

### 5. JSON output (для скриптов)

```bash
# Только JSON, без логов
result=$(c4c exec math.add --input '{"a":5,"b":3}' --json)
echo $result
# { "result": 8 }

# Использование в скриптах
if c4c exec validate.email --input '{"email":"test@example.com"}' --json | jq -e '.valid'; then
  echo "Email valid"
else
  echo "Email invalid"
fi
```

---

## Output формат

### Procedure

```bash
c4c exec users.create --input '{"name":"Alice","email":"alice@example.com"}'
```

**Output:**
```
[c4c] Discovering artifacts in /path/to/project...
[c4c] Executing procedure 'users.create'...
[c4c] Input: {
  "name": "Alice",
  "email": "alice@example.com"
}
[c4c] ✅ Success!
[c4c] Output: {
  "id": "user_123",
  "name": "Alice",
  "email": "alice@example.com",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Workflow

```bash
c4c exec simple-math-workflow --input '{}'
```

**Output:**
```
[c4c] Discovering artifacts in /path/to/project...
[c4c] Found workflow: Simple Math Workflow (v1.0.0)
[c4c] Executing workflow 'simple-math-workflow'...
[c4c] Input: {}
[c4c] ✅ Workflow completed successfully!
[c4c] Execution ID: wf_exec_abc123
[c4c] Status: completed
[c4c] Nodes executed: [ 'add', 'multiply', 'subtract' ]
[c4c] Execution time: 42ms
[c4c] Output: {
  "add": { "result": 15 },
  "multiply": { "result": 6 },
  "subtract": { "result": 12 }
}
```

### Ошибка: не найдено

```bash
c4c exec nonexistent
```

**Output:**
```
[c4c] Artifact 'nonexistent' not found.

Available procedures (42):
  - users.create
  - users.get
  - users.update
  - users.delete
  - products.list
  - products.create
  - orders.process
  - emails.send
  - math.add
  - math.subtract
  ... and 32 more

Available workflows (5):
  - user-onboarding
  - payment-processing
  - data-pipeline
  - simple-math-workflow
  - long-running-workflow
```

---

## Input обработка

### Оба типа поддерживают input!

**Procedure:**
```typescript
const procedure: Procedure = {
  contract: {
    name: "users.create",
    input: z.object({
      name: z.string(),
      email: z.string().email()
    }),
    ...
  },
  handler: async (input) => { ... }
};
```

**Workflow:**
```typescript
const workflow: WorkflowDefinition = {
  id: "user-onboarding",
  nodes: [...],
  variables: {}, // ← Input попадает сюда!
  ...
};
```

### Способы передачи input

```bash
# 1. JSON string
c4c exec users.create --input '{"name":"Alice","email":"alice@example.com"}'

# 2. JSON file
c4c exec users.create --input-file ./user-data.json

# 3. Empty input (default)
c4c exec simple-workflow
# Эквивалентно: --input '{}'
```

---

## Технические детали

### Алгоритм выполнения

```typescript
async function execCommand(name: string, options: ExecOptions) {
  // 1. Загрузить все артефакты
  const artifacts = await collectProjectArtifacts(rootDir);
  
  // 2. Парсить input (одинаково для обоих типов)
  const input = parseInput(options);
  
  // 3. Приоритет 1: Procedure
  const procedure = artifacts.procedures.get(name);
  if (procedure) {
    await executeProcedure(name, procedure, artifacts.procedures, input, options);
    return;
  }
  
  // 4. Приоритет 2: Workflow
  const workflow = artifacts.workflows.get(name);
  if (workflow) {
    await executeWorkflowById(name, workflow, artifacts.procedures, input, options);
    return;
  }
  
  // 5. Не найдено - helpful error
  throw new Error(formatAvailableArtifacts(artifacts));
}
```

### Логика input parsing

```typescript
function parseInput(options: ExecOptions): unknown {
  // Priority: file > string > empty object
  if (options.inputFile) {
    const content = await readFile(options.inputFile, 'utf-8');
    return JSON.parse(content);
  }
  
  if (options.input) {
    return JSON.parse(options.input);
  }
  
  return {}; // Default empty input
}
```

---

## Best Practices

### 1. Уникальные имена

Избегайте конфликтов:

```typescript
// ✅ Good
export const createUser: Procedure = {
  contract: { name: "users.create", ... },
  ...
};

export const userOnboardingWorkflow: WorkflowDefinition = {
  id: "user-onboarding",  // ← Другое имя
  ...
};

// ❌ Bad
export const test: Procedure = {
  contract: { name: "test", ... },
  ...
};

export const testWorkflow: WorkflowDefinition = {
  id: "test",  // ← Конфликт! Workflow не будет доступен через exec
  ...
};
```

### 2. Naming conventions

**Procedures:** `<resource>.<action>`
```
users.create
users.get
products.list
orders.process
```

**Workflows:** `<domain>-<action>` или `<process-name>`
```
user-onboarding
payment-processing
data-pipeline
simple-math-workflow
```

### 3. Input validation

**Procedures:** валидация встроена (Zod schema)
```typescript
contract: {
  input: z.object({
    email: z.string().email(),  // ← Автоматическая валидация
  }),
  ...
}
```

**Workflows:** валидация через первую ноду
```typescript
nodes: [
  {
    id: "validate-input",
    type: "procedure",
    procedureName: "input.validate",  // ← Валидирует input
    next: "process"
  },
  ...
]
```

---

## Migration Guide

### Было (до унификации)

```bash
# Разные флаги для разных типов
c4c exec users.create --input '{"name":"Alice"}'
c4c exec user-onboarding --workflow --input '{}'
```

### Стало (после унификации)

```bash
# Одна команда для всего
c4c exec users.create --input '{"name":"Alice"}'
c4c exec user-onboarding --input '{}'
```

**Никаких breaking changes!** Флаг `--workflow` просто больше не нужен.

---

## Summary

✅ **Unified approach** - одна команда для procedures и workflows
✅ **Smart detection** - автоматически определяет тип артефакта
✅ **Priority system** - procedures имеют приоритет
✅ **Consistent input** - одинаковый способ передачи данных
✅ **Helpful errors** - показывает доступные артефакты при ошибке
✅ **JSON mode** - для использования в скриптах

**Простота использования без потери гибкости!**
