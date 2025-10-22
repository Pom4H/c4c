# Real-Time Graph Fixes

## Проблемы которые были исправлены

### 1. ❌ Параллельные ноды не соединены со своими задачами

**Проблема:** 
- Параллельная нода (`type: "parallel"`) имеет массив `config.branches` с ID дочерних нод
- Граф создавал ребра только для `node.next`, но не для `config.branches`
- Результат: параллельные задачи были изолированы, не было видно что они являются частью parallel node

**Решение:**
Добавлен код в `ExecutionGraph.tsx` для создания ребер к branches:

```typescript
// Обработка параллельных нод - создаем ребра к branches
if (node.type === "parallel" && (node as any).config?.branches) {
  const branches = (node as any).config.branches as string[];
  branches.forEach((branchId) => {
    const sourceExecuted = execution.nodesExecuted.includes(node.id);
    const targetExecuted = execution.nodesExecuted.includes(branchId);
    const wasTraversed = sourceExecuted && targetExecuted;
    
    edges.push({
      id: `${node.id}-branch-${branchId}`,
      source: node.id,
      target: branchId,
      type: "smoothstep",
      animated: wasTraversed,
      style: {
        stroke: wasTraversed ? "#10b981" : "#d1d5db",
        strokeWidth: wasTraversed ? 2 : 1,
        strokeDasharray: "5,5", // Пунктирная линия для параллельных веток
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: wasTraversed ? "#10b981" : "#d1d5db",
      },
    });
  });
}
```

**Результат:** 
- ✅ Параллельные ноды теперь соединены со своими branches пунктирными линиями
- ✅ Видно какие задачи выполняются параллельно
- ✅ Линии анимируются когда задачи выполнены

---

### 2. ❌ Граф не обновляется в real-time

**Проблема:**
- `ExecutionGraph` использовал `useMemo` для создания `initialNodes` и `initialEdges`
- `useNodesState` и `useEdgesState` инициализировались только один раз
- При обновлении `execution` через SSE, `initialNodes` и `initialEdges` пересчитывались в `useMemo`
- НО: `useNodesState` и `useEdgesState` не обновлялись с новыми значениями
- Результат: граф "замораживался" на начальном состоянии

**Решение:**
Добавлены `useEffect` хуки для обновления nodes и edges:

```typescript
const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

// Обновлять nodes и edges когда execution меняется
useEffect(() => {
  setNodes(initialNodes);
}, [initialNodes, setNodes]);

useEffect(() => {
  setEdges(initialEdges);
}, [initialEdges, setEdges]);
```

**Результат:**
- ✅ Граф обновляется каждый раз когда execution меняется
- ✅ Цвета нод обновляются (pending → running → completed)
- ✅ Ребра анимируются когда ноды выполнены
- ✅ Duration отображается на нодах

---

### 3. ❌ SSE события не обновляют nodesExecuted

**Проблема:**
- SSE обработчик `node.completed` обновлял только `nodeDetails`
- Массив `nodesExecuted` не обновлялся
- `ExecutionGraph` использует `execution.nodesExecuted` для определения:
  - Была ли нода выполнена (opacity)
  - Было ли ребро пройдено (animation, color)
- Результат: граф не видел что ноды выполнены, останавливался на 3-4 ноде

**Решение:**
Обновлен обработчик `node.completed` в `executions/[id]/page.tsx`:

```typescript
eventSource.addEventListener("node.completed", (event) => {
  try {
    const data = JSON.parse(event.data);
    setExecution(prev => {
      if (!prev) return prev;
      
      // Добавить ноду в nodesExecuted если её там ещё нет
      const nodesExecuted = prev.nodesExecuted.includes(data.nodeId)
        ? prev.nodesExecuted
        : [...prev.nodesExecuted, data.nodeId];
      
      return {
        ...prev,
        nodesExecuted,  // ← ВАЖНО: обновляем массив
        nodeDetails: {
          ...prev.nodeDetails,
          [data.nodeId]: {
            ...prev.nodeDetails[data.nodeId],
            status: "completed",
            endTime: new Date().toISOString(),
          },
        },
      };
    });
  } catch (error) {
    console.error("Failed to process SSE event:", error);
  }
});
```

Также обновлен обработчик `workflow.completed`:

```typescript
eventSource.addEventListener("workflow.completed", (event) => {
  try {
    const data = JSON.parse(event.data);
    setExecution(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        status: "completed",
        endTime: new Date().toISOString(),
        executionTime: data.executionTime,
        nodesExecuted: data.nodesExecuted || prev.nodesExecuted, // ← Обновляем из события
      };
    });
    eventSource.close();
  } catch (error) {
    console.error("Failed to process SSE event:", error);
  }
});
```

**Результат:**
- ✅ `nodesExecuted` обновляется при каждом завершении ноды
- ✅ Граф видит прогресс выполнения
- ✅ Ноды становятся яркими (opacity: 1) после выполнения
- ✅ Ребра анимируются и меняют цвет
- ✅ Граф обновляется до самого конца workflow

---

## Итоговые изменения

### Файлы изменены:

1. **`apps/workflow/src/components/ExecutionGraph.tsx`**
   - ✅ Добавлен import `useEffect`
   - ✅ Добавлено создание ребер для parallel branches
   - ✅ Добавлены `useEffect` для обновления nodes/edges
   - ✅ Пунктирные линии для параллельных веток

2. **`apps/workflow/src/app/executions/[id]/page.tsx`**
   - ✅ Обработчик `node.completed` обновляет `nodesExecuted`
   - ✅ Обработчик `workflow.completed` обновляет `nodesExecuted`

---

## Как это работает теперь

### Real-Time Flow

```
1. Workflow execution начинается на backend
   ↓
2. Backend публикует SSE события:
   - workflow.started
   - node.started (для каждой ноды)
   - node.completed (для каждой ноды)
   - workflow.completed
   ↓
3. Frontend получает события через EventSource
   ↓
4. Обработчик node.completed:
   a. Обновляет nodeDetails[nodeId].status = "completed"
   b. Добавляет nodeId в nodesExecuted массив ← ВАЖНО!
   ↓
5. setExecution() вызывается с новым состоянием
   ↓
6. execution меняется → triggering useMemo пересчет:
   a. initialNodes пересчитываются (новые цвета, opacity)
   b. initialEdges пересчитываются (новые animations, colors)
   ↓
7. useEffect срабатывает:
   a. setNodes(initialNodes) - обновляет граф
   b. setEdges(initialEdges) - обновляет ребра
   ↓
8. ReactFlow re-renders:
   - Ноды меняют цвет
   - Ребра анимируются
   - Duration обновляется
   ↓
9. Пользователь видит real-time обновления! ✅
```

### Parallel Nodes Flow

```
Parallel Node: "parallel-tasks"
config.branches: ["task-1", "task-2", "task-3"]
next: "finalize"

Создаются ребра:
1. parallel-tasks → task-1 (пунктир)
2. parallel-tasks → task-2 (пунктир)
3. parallel-tasks → task-3 (пунктир)
4. parallel-tasks → finalize (сплошная)

При выполнении:
- parallel-tasks завершается
- task-1, task-2, task-3 выполняются параллельно
- Все 3 пунктирные линии анимируются
- finalize начинается после завершения всех tasks
- Сплошная линия к finalize анимируется
```

---

## Визуальные улучшения

### Статусы нод

| Статус | Цвет | Opacity | Box Shadow |
|--------|------|---------|------------|
| pending | Светло-серый (#e5e7eb) | 0.5 | - |
| running | Синий (#3b82f6) | 1.0 | Синяя тень |
| completed | Зеленый (#10b981) | 1.0 | - |
| failed | Красный (#ef4444) | 1.0 | - |

### Ребра

| Состояние | Цвет | Анимация | Толщина |
|-----------|------|----------|---------|
| Не пройдено | Серый (#d1d5db) | - | 1px |
| Пройдено | Зеленый (#10b981) | ✅ | 2px |
| Parallel branch | Как обычно | Как обычно | Пунктир 5,5 |

---

## Тестирование

### Запустите long-running workflow:

```bash
# Backend
cd /workspace/examples/integrations
pnpm c4c serve all

# Frontend
pnpm c4c serve ui --api-base http://localhost:3000
```

Откройте `http://localhost:3100/executions` и запустите **Long Running Workflow**

### Что наблюдать:

1. ✅ **Последовательные ноды:**
   - start → phase-1 → fetch-data → phase-2
   - Каждая нода меняет цвет: серый → синий → зеленый
   - Ребра анимируются последовательно

2. ✅ **Параллельная нода:**
   - parallel-tasks → compute-branch (пунктир)
   - parallel-tasks → io-branch (пунктир)
   - Обе ветки выполняются одновременно
   - Обе пунктирные линии анимируются

3. ✅ **Продолжение после parallel:**
   - parallel-tasks → phase-3 (сплошная)
   - После завершения обеих веток
   - Линия анимируется

4. ✅ **До конца:**
   - phase-3 → send-notification → complete
   - Все ноды становятся зелеными
   - Все ребра анимированы
   - Граф показывает полный путь выполнения

### DevTools проверка:

1. **Network → EventStream:**
   - События приходят в real-time
   - node.started, node.completed для каждой ноды

2. **Console:**
   - Нет ошибок SSE
   - Все события обрабатываются

3. **React DevTools:**
   - execution.nodesExecuted растет
   - execution.nodeDetails обновляется

---

## Решенные проблемы - резюме

| # | Проблема | Решение | Статус |
|---|----------|---------|--------|
| 1 | Параллельные ноды не соединены | Добавлены ребра к branches | ✅ |
| 2 | Граф не обновляется | useEffect для setNodes/setEdges | ✅ |
| 3 | Останавливается на 3-4 ноде | Обновление nodesExecuted в SSE | ✅ |

Теперь граф работает полностью в real-time! 🎉
