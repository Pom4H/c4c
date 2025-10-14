# Hono SSE Workflow Execution Guide

Этот документ описывает, как использовать Hono SSE (Server-Sent Events) для выполнения workflow вместо Next.js Server Actions.

## Обзор

Мы заменили Next.js Server Actions на Hono SSE эндпоинты для обеспечения real-time обновлений во время выполнения workflow. Это позволяет:

- Получать live обновления о прогрессе выполнения
- Видеть выполнение каждого узла workflow в реальном времени
- Отслеживать состояние выполнения через SSE события

## Архитектура

```
Next.js Frontend (React) 
    ↓ SSE Connection
Hono SSE Server (Port 3001)
    ↓ Workflow Execution
tsdev Framework (Registry + Procedures)
```

## Запуск

### 1. Запуск Hono SSE сервера

```bash
# В корне проекта
npm run dev:sse
```

Сервер запустится на порту 3001 и предоставит следующие эндпоинты:

- `GET /health` - Health check
- `GET /procedures` - Список доступных процедур
- `POST /workflow/execute-sse` - Выполнение workflow с SSE
- `POST /procedure/execute-sse/:name` - Выполнение процедуры с SSE
- `POST /workflow/validate` - Валидация workflow

### 2. Запуск Next.js приложения

```bash
# В папке examples/nextjs-workflow-viz
npm run dev
```

Приложение запустится на порту 3000 и будет подключаться к Hono SSE серверу.

## SSE События

### Workflow Execution Events

1. **workflow_started** - Начало выполнения workflow
2. **workflow_config** - Конфигурация workflow
3. **node_started** - Начало выполнения узла
4. **node_completed** - Завершение выполнения узла
5. **procedure_executing** - Выполнение процедуры
6. **procedure_executed** - Завершение процедуры
7. **workflow_completed** - Успешное завершение workflow
8. **workflow_error** - Ошибка выполнения workflow

### Procedure Execution Events

1. **procedure_started** - Начало выполнения процедуры
2. **procedure_input_validated** - Валидация входных данных
3. **procedure_execution_started** - Начало выполнения
4. **procedure_progress** - Прогресс выполнения
5. **procedure_execution_completed** - Завершение выполнения
6. **procedure_completed** - Успешное завершение
7. **procedure_error** - Ошибка выполнения

## Использование в коде

### SSE Client

```typescript
import { useWorkflowSSE } from "@/lib/sse-client";

const { executeWorkflow, executeProcedure } = useWorkflowSSE();

// Выполнение workflow с real-time обновлениями
const result = await executeWorkflow(
  workflow,
  input,
  (event) => {
    console.log("SSE Event:", event);
    // Обработка события
  }
);
```

### Обработка событий

```typescript
const handleExecute = async () => {
  try {
    const result = await executeWorkflow(
      selectedWorkflow,
      {},
      (event: SSEEvent) => {
        // Обновление UI в реальном времени
        setSseEvents(prev => [...prev, event]);
        
        if (event.type === "workflow_completed") {
          setExecutionResult(event.result);
        }
      }
    );
  } catch (error) {
    console.error("Execution failed:", error);
  }
};
```

## Преимущества SSE подхода

1. **Real-time обновления** - Пользователь видит прогресс выполнения в реальном времени
2. **Лучший UX** - Индикаторы прогресса и live статус
3. **Отладка** - Легко отслеживать выполнение каждого шага
4. **Масштабируемость** - Hono обеспечивает высокую производительность
5. **Совместимость** - Работает с любым фронтендом, поддерживающим SSE

## Отличия от Server Actions

| Server Actions | Hono SSE |
|----------------|----------|
| Одноразовый запрос | Потоковое соединение |
| Нет real-time обновлений | Live обновления |
| Только результат | Промежуточные состояния |
| Next.js зависимость | Универсальный подход |

## Настройка

### Изменение порта SSE сервера

```typescript
// В src/apps/hono-sse-server.ts
const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
```

### Изменение URL SSE клиента

```typescript
// В src/lib/sse-client.ts
const client = createWorkflowSSEClient("http://localhost:3001");
```

## Отладка

### Логирование SSE событий

```typescript
(event: SSEEvent) => {
  console.log("SSE Event:", event);
  // Дополнительная обработка
}
```

### Проверка соединения

```bash
# Проверка health endpoint
curl http://localhost:3001/health

# Проверка процедур
curl http://localhost:3001/procedures
```

## Заключение

Hono SSE подход обеспечивает более интерактивный и информативный пользовательский опыт при выполнении workflow, предоставляя real-time обновления и детальную информацию о прогрессе выполнения.