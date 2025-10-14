# Next.js 15 Workflow Visualization Example

## Обзор

Этот пример демонстрирует полнофункциональное Next.js 15 приложение с:

1. **Server Actions** для выполнения workflow
2. **OpenTelemetry** интеграция для сбора трейсов
3. **React Flow** для интерактивной визуализации
4. **Real-time обновление** статуса выполнения

## Быстрый старт

```bash
# Установка зависимостей
cd examples/nextjs-workflow-viz
npm install

# Запуск dev сервера
npm run dev

# Открыть http://localhost:3000
```

## Ключевые особенности

### 1. Server Actions Integration

```typescript
// src/app/actions.ts
"use server";

export async function executeWorkflowAction(
  workflowId: string,
  input?: Record<string, unknown>
): Promise<WorkflowExecutionResult> {
  const workflow = workflows[workflowId];
  const result = await executeWorkflow(workflow, input);
  return result; // Автоматическая сериализация для клиента
}
```

**Преимущества:**
- Типобезопасные RPC вызовы
- Автоматическая сериализация
- Нет необходимости в API routes
- Оптимизированная производительность

### 2. OpenTelemetry Protocol

Полная интеграция с OpenTelemetry для трейсинга:

```typescript
// Каждый workflow execution создает структурированные трейсы
{
  "spanId": "span_1",
  "traceId": "trace_xxx",
  "name": "workflow.execute",
  "attributes": {
    "workflow.id": "math-calculation",
    "workflow.execution_id": "exec_xxx"
  },
  "children": [
    {
      "name": "workflow.node.procedure",
      "attributes": {
        "node.id": "add-numbers",
        "procedure.name": "math.add"
      }
    }
  ]
}
```

### 3. React Flow Visualization

Интерактивный граф workflow с:

- **Автоматический layout** узлов по уровням
- **Цветовая кодировка** по типам узлов
- **Анимация выполнения** в реальном времени
- **MiniMap** для навигации
- **Zoom & Pan** для больших графов

### 4. Типы Workflow Узлов

#### Procedure Node
```typescript
{
  id: "add-numbers",
  type: "procedure",
  procedureName: "math.add",
  config: { a: 10, b: 5 },
  next: "multiply-result"
}
```

#### Condition Node
```typescript
{
  id: "check-premium",
  type: "condition",
  config: {
    expression: "isPremium === true",
    trueBranch: "premium-processing",
    falseBranch: "basic-processing"
  }
}
```

#### Parallel Node
```typescript
{
  id: "parallel-execution",
  type: "parallel",
  config: {
    branches: ["task-1", "task-2", "task-3"],
    waitForAll: true
  },
  next: "aggregate"
}
```

## Примеры Workflow

### 1. Math Calculation (Простой)

Демонстрирует последовательное выполнение:

```
add(10, 5) → 15
  ↓
multiply(15, 2) → 30
  ↓
subtract(100, 30) → 70
```

### 2. Conditional Processing (Ветвление)

Демонстрирует условную логику:

```
fetch-user
  ↓
check-premium
  ├─ true → premium-processing
  └─ false → basic-processing
  ↓
save-results
```

### 3. Parallel Tasks (Параллельность)

Демонстрирует параллельное выполнение:

```
parallel-execution
  ├─ task-1: add(10, 20)
  ├─ task-2: multiply(5, 6)
  └─ task-3: subtract(100, 25)
  ↓ (wait for all)
aggregate-results
```

### 4. Complex Workflow (Комбинированный)

Комбинация всех паттернов:

```
init-data
  ↓
parallel-checks
  ├─ check-1
  └─ check-2
  ↓ (wait for all)
evaluate-results
  ├─ high-score → high-score-processing
  └─ low-score → low-score-processing
  ↓
finalize
```

## Архитектурные решения

### 1. Серверная vs Клиентская логика

**Сервер (Server Actions):**
- Выполнение workflow
- Сбор OpenTelemetry трейсов
- Доступ к данным и внешним сервисам

**Клиент (React Components):**
- Визуализация графа
- Интерактивность
- Отображение результатов

### 2. Управление состоянием

```typescript
const [executionResult, setExecutionResult] = 
  useState<WorkflowExecutionResult | null>(null);

const handleExecute = async () => {
  const result = await executeWorkflowAction(workflowId);
  setExecutionResult(result); // Автоматическое обновление UI
};
```

### 3. Типобезопасность

Полная типизация от сервера до клиента:

```typescript
// Типы используются везде
WorkflowDefinition → executeWorkflow() → WorkflowExecutionResult
                                         ↓
                                    React Components
```

## Интеграция с основным проектом

Этот пример легко интегрируется с основным tsdev проектом:

```typescript
// Вместо mock procedures
import { registry } from "@/core/registry";
import { executeWorkflow } from "@/workflow/runtime";

// Используем реальный registry
const result = await executeWorkflow(workflow, registry, input);
```

## Расширение функционала

### Добавить real-time updates

```typescript
// Server Action с streaming
export async function executeWorkflowStream(workflowId: string) {
  const stream = new ReadableStream({
    async start(controller) {
      // Отправляем updates по мере выполнения
      for await (const update of executeWorkflowWithUpdates(workflow)) {
        controller.enqueue(update);
      }
    }
  });
  return stream;
}
```

### Добавить персистентность

```typescript
// Сохранение результатов в БД
export async function executeWorkflowAction(workflowId: string) {
  const result = await executeWorkflow(workflow);
  
  await db.workflowExecutions.create({
    data: {
      workflowId,
      executionId: result.executionId,
      status: result.status,
      spans: result.spans
    }
  });
  
  return result;
}
```

### Добавить webhook notifications

```typescript
// Уведомление о завершении
const result = await executeWorkflow(workflow);

if (result.status === "completed") {
  await fetch(webhookUrl, {
    method: "POST",
    body: JSON.stringify(result)
  });
}
```

## Production Ready Features

Для production использования добавьте:

1. **Аутентификация** - защитите Server Actions
2. **Rate Limiting** - ограничение запросов
3. **Error Boundary** - обработка ошибок UI
4. **Logging** - детальное логирование
5. **Monitoring** - метрики производительности
6. **Caching** - кэширование результатов
7. **Queue System** - очередь для длительных workflow

## Метрики производительности

Типичные метрики из примера:

- **Math Workflow**: ~1.5s (3 узла)
- **Conditional Workflow**: ~2.5s (5 узлов)
- **Parallel Workflow**: ~1.0s (4 узла, параллельно)
- **Complex Workflow**: ~3.5s (8 узлов)

## Дополнительные ресурсы

- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [React Flow Documentation](https://reactflow.dev/)
- [OpenTelemetry JavaScript](https://opentelemetry.io/docs/instrumentation/js/)
- [Workflow System Guide](../../WORKFLOW_SYSTEM.md)
- [Telemetry Guide](../../WORKFLOW_TELEMETRY_GUIDE.md)

## Заключение

Этот пример демонстрирует современный подход к построению workflow систем с Next.js 15:

✅ Типобезопасность от сервера до клиента  
✅ Полная интеграция с OpenTelemetry  
✅ Интерактивная визуализация  
✅ Production-ready архитектура  
✅ Легко расширяемый  

Используйте его как основу для ваших workflow приложений!
