# Next.js 15 Workflow Visualization with OpenTelemetry

Пример приложения на Next.js 15.0.5 с серверными экшенами для запуска workflow и фронтенд компонентом для визуализации работы workflow с использованием OpenTelemetry протокола и React Flow.

## 🚀 Возможности

- **Next.js 15.0.5** с App Router
- **Server Actions** для выполнения workflow на сервере
- **React Flow** для интерактивной визуализации графа workflow
- **OpenTelemetry Protocol** для сбора и отображения трейсов
- **Реактивное обновление** визуализации по мере выполнения
- **4 примера workflow**: простой, условный, параллельный и комплексный

## 📦 Установка

```bash
cd examples/nextjs-workflow-viz
npm install
```

## 🏃 Запуск

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## 🏗️ Архитектура

### Структура проекта

```
examples/nextjs-workflow-viz/
├── src/
│   ├── app/
│   │   ├── actions.ts              # Server Actions
│   │   ├── page.tsx                # Главная страница
│   │   ├── layout.tsx              # Базовый layout
│   │   └── globals.css             # Глобальные стили
│   ├── components/
│   │   ├── WorkflowVisualizer.tsx  # React Flow визуализация
│   │   └── TraceViewer.tsx         # OpenTelemetry trace viewer
│   └── lib/
│       └── workflow/
│           ├── types.ts            # TypeScript типы
│           ├── runtime.ts          # Workflow runtime executor
│           └── examples.ts         # Примеры workflow
├── package.json
├── tsconfig.json
├── next.config.ts
└── tailwind.config.ts
```

### Компоненты системы

#### 1. Server Actions (`src/app/actions.ts`)

Server Actions выполняют workflow на сервере и собирают OpenTelemetry трейсы:

```typescript
"use server";

export async function executeWorkflowAction(
  workflowId: string,
  input?: Record<string, unknown>
): Promise<WorkflowExecutionResult> {
  const workflow = workflows[workflowId];
  const result = await executeWorkflow(workflow, input);
  return result;
}
```

#### 2. Workflow Runtime (`src/lib/workflow/runtime.ts`)

Выполняет workflow с полной интеграцией OpenTelemetry:

- Создает spans для каждого узла workflow
- Отслеживает время выполнения
- Записывает атрибуты и события
- Поддерживает различные типы узлов:
  - **procedure** - выполнение процедуры
  - **condition** - условное ветвление
  - **parallel** - параллельное выполнение
  - **sequential** - последовательное выполнение

#### 3. React Flow Visualizer (`src/components/WorkflowVisualizer.tsx`)

Интерактивная визуализация workflow:

- Отображает узлы с цветовой кодировкой по типам
- Показывает связи между узлами
- Анимирует выполненные узлы
- Отображает время выполнения каждого узла
- MiniMap для навигации по большим графам

#### 4. Trace Viewer (`src/components/TraceViewer.tsx`)

Визуализация OpenTelemetry трейсов:

- Timeline view с относительным позиционированием
- Подробности каждого span (атрибуты, события)
- Статистика выполнения
- Индикация ошибок

## 📊 Примеры Workflow

### 1. Math Calculation Workflow

Простой последовательный workflow:
- Сложение: 10 + 5 = 15
- Умножение: 15 × 2 = 30
- Вычитание: 100 - 30 = 70

### 2. Conditional Processing Workflow

Workflow с условным ветвлением:
- Получение данных пользователя
- Проверка premium статуса
- Разная обработка для premium/basic
- Сохранение результата

### 3. Parallel Tasks Workflow

Параллельное выполнение задач:
- 3 задачи выполняются одновременно
- Ожидание завершения всех задач
- Агрегация результатов

### 4. Complex Workflow

Комбинация всех паттернов:
- Последовательное выполнение
- Параллельные проверки
- Условное ветвление
- Финализация

## 🔍 OpenTelemetry Integration

### Структура трейсов

```
workflow.execute                    # Root span
├── workflow.node.procedure
│   └── procedure.math.add         # Процедура выполнения
│       ├── event: procedure.input
│       └── event: procedure.output
├── workflow.node.condition
└── workflow.node.parallel
    ├── workflow.parallel.branch
    ├── workflow.parallel.branch
    └── workflow.parallel.branch
```

### Атрибуты span

- `workflow.id` - ID workflow
- `workflow.name` - Название workflow
- `workflow.execution_id` - ID выполнения
- `node.id` - ID узла
- `node.type` - Тип узла
- `procedure.name` - Имя процедуры

### События

- `procedure.input` - Входные данные процедуры
- `procedure.output` - Результат выполнения

## 🎨 UI Особенности

### Цветовая кодировка узлов

- 🟢 **Procedure** - зеленый (#4ade80)
- 🟡 **Condition** - желтый (#fbbf24)
- 🟣 **Parallel** - фиолетовый (#818cf8)
- 🔵 **Sequential** - синий (#60a5fa)

### Индикаторы статуса

- Светлый фон - узел не выполнен
- Яркий фон - узел выполнен успешно
- Красная граница - ошибка выполнения
- Анимированные связи - активный путь выполнения

## 🛠️ Технологии

- **Next.js 15.0.5** - React framework
- **React 19** - UI библиотека
- **TypeScript** - Типизация
- **React Flow** - Визуализация графов
- **OpenTelemetry API** - Трейсинг
- **Tailwind CSS** - Стилизация
- **Zod** - Валидация схем

## 📝 Расширение

### Добавление нового workflow

```typescript
// src/lib/workflow/examples.ts
export const myWorkflow: WorkflowDefinition = {
  id: "my-workflow",
  name: "My Custom Workflow",
  version: "1.0.0",
  startNode: "start",
  nodes: [
    {
      id: "start",
      type: "procedure",
      procedureName: "my.procedure",
      config: { param: "value" },
      next: "end",
    },
  ],
};
```

### Добавление новой процедуры

```typescript
// src/lib/workflow/runtime.ts
const mockProcedures = {
  "my.procedure": async (input) => {
    // Ваша логика
    return { result: "value" };
  },
};
```

## 🔗 Интеграция с основным проектом

Этот пример может быть интегрирован с основным tsdev проектом:

```typescript
import { executeWorkflow } from "@/workflow/runtime";
import { registry } from "@/core/registry";

// Использование реального registry вместо mock procedures
const result = await executeWorkflow(workflow, registry, initialInput);
```

## 📚 Дополнительная информация

- [Next.js Documentation](https://nextjs.org/docs)
- [React Flow](https://reactflow.dev/)
- [OpenTelemetry](https://opentelemetry.io/)
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)

## 📄 Лицензия

MIT
