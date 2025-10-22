# Long-Running Workflows для демонстрации Real-Time Updates

## Новые Workflows

Созданы два новых workflow специально для демонстрации real-time обновлений в UI:

### 1. **Long Running Workflow** (~1 минута)

**ID:** `long-running-workflow`  
**Время выполнения:** ~1 минута  
**Назначение:** Идеально для наблюдения за real-time обновлениями

**Структура:**
```
1. Start (лог)
2. Phase 1: Initializing (10 секунд delay)
3. Fetch Data (мгновенно)
4. Phase 2: Processing (15 секунд delay)
5. Parallel Tasks (параллельно):
   - Heavy Computation (~5 секунд)
   - Database Save (12 секунд delay)
6. Phase 3: Finalizing (10 секунд delay)
7. Send Notification (мгновенно)
8. Complete (лог)
```

**Что можно наблюдать:**
- ✅ Поэтапное выполнение нод
- ✅ Параллельное выполнение двух веток
- ✅ Обновление статуса в real-time
- ✅ Прогресс в консоли

### 2. **Very Long Workflow** (~2 минуты)

**ID:** `very-long-workflow`  
**Время выполнения:** ~2 минуты  
**Назначение:** Расширенная демонстрация с множеством стадий

**Структура:**
```
1. Start (лог)
2. Stage 1/6: Setup (20 секунд)
3. Stage 2/6: Data Collection (20 секунд)
4. Stage 3/6: Heavy Processing (~8 секунд вычислений)
5. Stage 4/6: Validation (20 секунд)
6. Stage 5/6: Parallel Tasks (15 секунд каждая):
   - Task A: Analytics
   - Task B: Backup
   - Task C: Notifications
7. Stage 6/6: Cleanup (15 секунд)
8. Complete (лог)
```

**Что можно наблюдать:**
- ✅ Длительный multi-stage процесс
- ✅ Параллельное выполнение 3 веток
- ✅ Прогресс через 6 стадий
- ✅ Детальные логи в консоли

---

## Новые Процедуры

### `custom.delay`

Задержка выполнения на указанное количество секунд.

**Input:**
```typescript
{
  seconds: number,      // 0-300 секунд
  message?: string      // Опциональное сообщение для лога
}
```

**Output:**
```typescript
{
  delayed: boolean,
  seconds: number,
  startTime: string,    // ISO timestamp
  endTime: string       // ISO timestamp
}
```

**Пример:**
```typescript
{
  id: "wait",
  type: "procedure",
  procedureName: "custom.delay",
  config: {
    seconds: 10,
    message: "Waiting for processing..."
  }
}
```

### `custom.heavyComputation`

Имитация тяжелых вычислений.

**Input:**
```typescript
{
  iterations: number,   // 1 - 1,000,000
  label?: string        // Опциональная метка
}
```

**Output:**
```typescript
{
  completed: boolean,
  iterations: number,
  result: number,       // Результат вычислений
  duration: number      // Время выполнения в ms
}
```

**Пример:**
```typescript
{
  id: "compute",
  type: "procedure",
  procedureName: "custom.heavyComputation",
  config: {
    iterations: 500000,
    label: "Computing analytics..."
  }
}
```

---

## Как использовать

### Через API

**Long Running Workflow (1 минута):**
```bash
curl -X POST http://localhost:3000/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{"workflowId": "long-running-workflow"}'
```

**Very Long Workflow (2 минуты):**
```bash
curl -X POST http://localhost:3000/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{"workflowId": "very-long-workflow"}'
```

### Через UI

1. Запустите backend:
   ```bash
   cd /workspace/examples/integrations
   pnpm c4c serve all
   ```

2. Запустите frontend UI:
   ```bash
   pnpm c4c serve ui --api-base http://localhost:3000
   ```

3. Откройте браузер:
   ```
   http://localhost:3100/executions
   ```

4. Выберите workflow из выпадающего списка:
   - **Long Running Workflow (1 minute)**
   - **Very Long Workflow (2 minutes)**

5. Нажмите **Execute**

---

## Что наблюдать в Real-Time

### В списке executions (`/executions`)

1. ✅ **Execution появляется мгновенно** со статусом "running"
2. ✅ **Статистика обновляется:**
   - Running: +1
   - Total: +1
3. ✅ **После завершения автоматически обновляется:**
   - Running: -1
   - Completed: +1
4. ✅ **Время выполнения обновляется** в real-time

### На странице детального execution (`/executions/:id`)

1. ✅ **Граф workflow:**
   - Активная нода подсвечивается
   - Выполненные ноды меняют цвет
   - Анимация переходов между нодами

2. ✅ **Timeline (Gantt):**
   - Spans появляются по мере выполнения
   - Видна длительность каждой ноды
   - Параллельные ноды отображаются одновременно

3. ✅ **Trace Viewer:**
   - Иерархия spans обновляется
   - Время выполнения каждого span
   - Атрибуты и метаданные

4. ✅ **Node Details (правая панель):**
   - Статус ноды обновляется (pending → running → completed)
   - Output появляется после выполнения
   - Duration обновляется

5. ✅ **Status Bar:**
   - Duration тикает в real-time
   - Nodes Executed: X / Total
   - Status badge обновляется

---

## Консольные логи

При выполнении workflow в консоли backend сервера можно видеть:

```
[delay] ⏳ Phase 1: Initializing (10 seconds)...
[delay] Completed after 10 seconds
[delay] ⏳ Phase 2: Processing data (15 seconds)...
[heavyComputation] 💻 Computing analytics... with 500000 iterations...
[heavyComputation] Progress: 100000/500000
[heavyComputation] Progress: 200000/500000
[heavyComputation] Progress: 300000/500000
[heavyComputation] Progress: 400000/500000
[heavyComputation] Completed in 4823ms
[delay] 💾 Saving to database...
[delay] Completed after 12 seconds
[delay] ⏳ Phase 3: Finalizing (10 seconds)...
[delay] Completed after 10 seconds
[sendNotification] [slack] ✅ Long-running workflow completed successfully!
[log] 🎉 Workflow completed! Total time: ~1 minute
[Workflow] ✅ Completed: long-running-workflow (47234ms, 9 nodes)
```

---

## SSE Events

Во время выполнения через SSE приходят события:

```
event: workflow.started
data: {"type":"workflow.started","workflowId":"long-running-workflow",...}

event: node.started
data: {"type":"node.started","nodeId":"start",...}

event: node.completed
data: {"type":"node.completed","nodeId":"start",...}

event: executions.update
data: {"executions":[...],"stats":{...}}

event: node.started
data: {"type":"node.started","nodeId":"phase-1",...}

... (продолжается для каждой ноды)

event: workflow.completed
data: {"type":"workflow.completed","executionTime":47234,...}

event: executions.update
data: {"executions":[...],"stats":{...}}
```

---

## Тайминги

### Long Running Workflow (~1 минута)

| Нода | Тип | Время |
|------|-----|-------|
| start | log | ~0ms |
| phase-1 | delay | 10s |
| fetch-data | data.fetch | ~0ms |
| phase-2 | delay | 15s |
| **parallel-tasks** | **parallel** | **~12s** |
| ├─ compute-branch | heavyComputation | ~5s |
| └─ io-branch | delay | 12s |
| phase-3 | delay | 10s |
| send-notification | sendNotification | ~0ms |
| complete | log | ~0ms |
| **TOTAL** | | **~47s** |

### Very Long Workflow (~2 минуты)

| Нода | Тип | Время |
|------|-----|-------|
| start | log | ~0ms |
| stage-1 | delay | 20s |
| stage-2 | delay | 20s |
| stage-3 | heavyComputation | ~8s |
| stage-4 | delay | 20s |
| **stage-5-parallel** | **parallel** | **~15s** |
| ├─ parallel-task-1 | delay | 15s |
| ├─ parallel-task-2 | delay | 15s |
| └─ parallel-task-3 | delay | 15s |
| stage-6 | delay | 15s |
| complete | log | ~0ms |
| **TOTAL** | | **~98s** |

---

## Tips для наблюдения

### Для лучшей демонстрации:

1. **Откройте два окна браузера рядом:**
   - Левое: список executions
   - Правое: детальная страница execution

2. **Запустите workflow из списка** и сразу перейдите на детальную страницу

3. **Наблюдайте синхронно:**
   - Список обновляет статистику
   - Детальная страница показывает прогресс нод

4. **Откройте DevTools → Network → EventStream:**
   - Видно как приходят SSE события
   - Частота обновлений
   - Типы событий

5. **Откройте консоль backend сервера:**
   - Логи процедур
   - Прогресс вычислений
   - Завершение workflow

---

## Расширение

Вы можете создать свои long-running workflows:

```typescript
export const myLongWorkflow: WorkflowDefinition = {
  id: "my-long-workflow",
  name: "My Long Workflow",
  version: "1.0.0",
  startNode: "step1",
  nodes: [
    {
      id: "step1",
      type: "procedure",
      procedureName: "custom.delay",
      config: {
        seconds: 30,
        message: "Step 1: Processing..."
      },
      next: "step2"
    },
    {
      id: "step2",
      type: "procedure",
      procedureName: "custom.heavyComputation",
      config: {
        iterations: 1000000,
        label: "Step 2: Heavy calculations..."
      },
      next: "step3"
    },
    // ... добавьте больше шагов
  ]
};
```

---

## Сравнение с быстрыми workflows

| Workflow | Время | Ноды | Назначение |
|----------|-------|------|------------|
| simple-math-workflow | ~0ms | 3 | Быстрый тест |
| data-processing-workflow | ~0ms | 5 | Условия |
| parallel-workflow | ~0ms | 6 | Параллелизм |
| logging-workflow | ~0ms | 3 | Логирование |
| **long-running-workflow** | **~1min** | **9** | **Real-time demo** |
| **very-long-workflow** | **~2min** | **11** | **Extended demo** |

---

Теперь у вас есть идеальные workflows для демонстрации real-time обновлений! 🎉
