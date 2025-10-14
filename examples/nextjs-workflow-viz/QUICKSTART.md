# 🚀 Quick Start Guide

## Установка и запуск за 60 секунд

```bash
# 1. Перейдите в директорию примера
cd examples/nextjs-workflow-viz

# 2. Установите зависимости
npm install

# 3. Запустите dev сервер
npm run dev

# 4. Откройте в браузере
# → http://localhost:3000
```

## Что делать дальше?

### Шаг 1: Выберите workflow

В выпадающем списке выберите один из 4 примеров:
- 📊 Math Calculation (простой)
- 🔀 Conditional Processing (с ветвлением)
- ⚡ Parallel Tasks (параллельный)
- 🎯 Complex Workflow (комплексный)

### Шаг 2: Выполните workflow

Нажмите кнопку **"▶ Execute Workflow"**

Вы увидите:
- ✅ Статус выполнения (completed/failed)
- ⏱️ Время выполнения в миллисекундах
- 📊 Количество выполненных узлов
- 🔍 Количество собранных OpenTelemetry spans

### Шаг 3: Изучите визуализацию

#### Вкладка "Workflow Graph"

Интерактивный граф workflow:
- **Зеленые узлы** = выполнены успешно
- **Серые узлы** = не выполнены
- **Анимированные связи** = активный путь
- **Цифры под узлами** = время выполнения

Возможности:
- 🔍 Zoom колесиком мыши
- 👆 Drag & drop для перемещения
- 🗺️ MiniMap для навигации

#### Вкладка "OpenTelemetry Traces"

Timeline трейсов:
- Каждая строка = один span
- Длина блока = время выполнения
- Цвет: синий = OK, красный = ERROR
- Раскрывающиеся детали = атрибуты и события

## Примеры использования

### Пример 1: Math Calculation

Последовательное выполнение математических операций:

```
1. add(10, 5) = 15
2. multiply(15, 2) = 30
3. subtract(100, 30) = 70
```

**Ожидаемый результат:**
- 3 узла выполнены
- ~1.5 секунд
- 7-10 spans (workflow + nodes + procedures)

### Пример 2: Conditional Processing

Демонстрирует ветвление по условию:

```
1. Получить данные пользователя
2. Проверить isPremium
3a. Если true → premium обработка
3b. Если false → basic обработка
4. Сохранить результат
```

**Ожидаемый результат:**
- 4 узла выполнены (с одной веткой)
- ~2.5 секунд
- Видно только выполненную ветку

### Пример 3: Parallel Tasks

Параллельное выполнение:

```
Запускаются одновременно:
- task-1: add(10, 20)
- task-2: multiply(5, 6)
- task-3: subtract(100, 25)

Затем агрегация результатов
```

**Ожидаемый результат:**
- 4 узла выполнены
- ~1.0 секунда (быстрее благодаря параллельности)
- 3 параллельных branch spans

### Пример 4: Complex Workflow

Комбинация всех паттернов:

```
1. Инициализация
2. Параллельные проверки (2 ветки)
3. Условие по результату
4. Одна из веток обработки
5. Финализация
```

**Ожидаемый результат:**
- 6-7 узлов выполнены
- ~3.5 секунд
- Сложная структура spans

## Что происходит под капотом?

### 1. Клик на "Execute Workflow"

```typescript
// Вызов Server Action
const result = await executeWorkflowAction(workflowId);
```

### 2. Server Action выполняет workflow

```typescript
// На сервере
const workflow = getWorkflow(workflowId);
const result = await executeWorkflow(workflow);
// Собирает OpenTelemetry traces
return result; // Сериализуется и отправляется клиенту
```

### 3. Клиент обновляет UI

```typescript
// Обновление состояния
setExecutionResult(result);

// React автоматически перерендерит:
// - WorkflowVisualizer с новыми данными
// - TraceViewer с spans
// - Статистику выполнения
```

## Изменение примера

### Создать свой workflow

Отредактируйте `src/lib/workflow/examples.ts`:

```typescript
export const myWorkflow: WorkflowDefinition = {
  id: "my-custom-workflow",
  name: "My Custom Workflow",
  version: "1.0.0",
  startNode: "step-1",
  nodes: [
    {
      id: "step-1",
      type: "procedure",
      procedureName: "math.add",
      config: { a: 100, b: 200 },
      next: "step-2"
    },
    {
      id: "step-2",
      type: "procedure",
      procedureName: "math.multiply",
      config: { a: 10 },
      next: undefined // конец workflow
    }
  ]
};
```

Добавьте в список:

```typescript
// src/app/actions.ts
const workflows = {
  // ... existing workflows
  "my-custom-workflow": myWorkflow,
};
```

Перезагрузите страницу - ваш workflow появится в списке!

### Добавить новую процедуру

В `src/lib/workflow/runtime.ts`:

```typescript
const mockProcedures = {
  // ... existing procedures
  "string.concat": async (input: { str1: string; str2: string }) => {
    await delay(300); // Имитация работы
    return { result: input.str1 + input.str2 };
  },
};
```

Используйте в узлах:

```typescript
{
  id: "concat-strings",
  type: "procedure",
  procedureName: "string.concat",
  config: { str1: "Hello", str2: " World" },
}
```

## Troubleshooting

### Ошибка при установке

```bash
# Очистите кэш и переустановите
rm -rf node_modules package-lock.json
npm install
```

### Порт 3000 занят

```bash
# Запустите на другом порту
PORT=3001 npm run dev
```

### Workflow не выполняется

Проверьте консоль браузера (F12):
- Ошибки Server Action
- Ошибки валидации
- Network requests

### UI не обновляется

Проверьте React DevTools:
- State компонента
- Props передаются ли
- Нет ли ошибок рендера

## Следующие шаги

1. 📖 Прочитайте [EXAMPLE.md](./EXAMPLE.md) для глубокого понимания
2. 🔍 Изучите [README.md](./README.md) для технических деталей
3. 💻 Посмотрите код компонентов
4. 🎨 Кастомизируйте UI под свои нужды
5. 🚀 Интегрируйте с основным проектом

## Полезные команды

```bash
# Development
npm run dev              # Запуск dev сервера

# Production build
npm run build            # Сборка для production
npm run start            # Запуск production сервера

# Linting
npm run lint             # Проверка кода
```

## Нужна помощь?

- 📚 [Документация Next.js](https://nextjs.org/docs)
- 🎨 [React Flow Docs](https://reactflow.dev/)
- 📊 [OpenTelemetry JS](https://opentelemetry.io/docs/instrumentation/js/)
- 💬 Issues в GitHub репозитории

---

**Готово!** Теперь вы можете экспериментировать с workflow визуализацией! 🎉
