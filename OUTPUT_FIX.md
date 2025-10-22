# Output Fix - Node Output было undefined

## Проблема

При выполнении workflow все ноды показывали `output: undefined`:

```
[SSE] node.completed: stage-1 output: undefined
[SSE] node.completed: stage-2 output: undefined
[SSE] node.completed: stage-3 output: undefined
```

Output появлялся только после перезагрузки страницы.

## Причина

В главном цикле workflow execution (`packages/workflow/src/runtime.ts`) output извлекался с неправильным ключом:

**Было:**
```typescript
const nextNodeId = await executeNode(node, workflowContext, registry, workflow);

// Используется currentNodeId - НЕПРАВИЛЬНО!
executionStore.updateNodeStatus(executionId, currentNodeId, "completed", {
  endTime: new Date(),
  output: workflowContext.nodeOutputs.get(currentNodeId), // ← currentNodeId
});

publish({
  type: "node.completed",
  nodeId: node.id,
  output: workflowContext.nodeOutputs.get(currentNodeId), // ← currentNodeId
});
```

**Проблема:**
- `currentNodeId` - это ID ноды которую мы **только начали** выполнять
- Output сохраняется в `executeProcedureNode` под ключом `node.id`
- После `executeNode()` возвращается `nextNodeId`
- Затем `currentNodeId = nextNodeId` (переходим к следующей ноде)
- Когда публикуем `node.completed`, пытаемся получить output по `currentNodeId`
- Но к этому моменту output был сохранен под `node.id`, не под `currentNodeId`
- Результат: `nodeOutputs.get(currentNodeId)` возвращает `undefined`

## Решение

Использовать `node.id` вместо `currentNodeId` для получения output:

**Стало:**
```typescript
const nextNodeId = await executeNode(node, workflowContext, registry, workflow);

// Get output for THIS node (use node.id!)
const nodeOutput = workflowContext.nodeOutputs.get(node.id); // ← node.id!
console.log(`[Workflow] Node ${node.id} output:`, nodeOutput);

// Update node status in store
executionStore.updateNodeStatus(executionId, node.id, "completed", {
  endTime: new Date(),
  output: nodeOutput, // ← правильный output
});

publish({
  type: "node.completed",
  workflowId: workflow.id,
  executionId,
  nodeId: node.id,
  nodeIndex,
  nextNodeId,
  timestamp: Date.now(),
  output: nodeOutput, // ← правильный output
});
```

**Изменения:**
1. ✅ Извлекаем output с правильным ключом: `node.id`
2. ✅ Сохраняем в переменную `nodeOutput`
3. ✅ Добавлен лог для проверки: `console.log(Node ${node.id} output:, nodeOutput)`
4. ✅ Используем эту переменную для store и события

## Как это работает

### Flow сохранения и извлечения output:

```
1. Main loop: currentNodeId = "stage-1"
   node = workflow.nodes.find(n => n.id === currentNodeId)
   node.id = "stage-1"
   ↓
2. executeNode(node, ...)
   ↓
3. executeProcedureNode(node, ...)
   const output = await executeProcedure(...)
   context.nodeOutputs.set(node.id, output)  // ← Сохраняется под node.id!
   ↓
4. Main loop продолжается:
   const nodeOutput = workflowContext.nodeOutputs.get(node.id)  // ← Получаем по node.id!
   nodeOutput = {delayed: true, seconds: 20, ...}  // ← Правильный output!
   ↓
5. publish({
     type: "node.completed",
     nodeId: node.id,
     output: nodeOutput  // ← Передается в событие
   })
   ↓
6. SSE отправляет на frontend:
   event: node.completed
   data: {"nodeId":"stage-1","output":{"delayed":true,"seconds":20,...}}
   ↓
7. Frontend получает и отображает output
```

## До и После

### До исправления:

**Backend logs:**
```
[Workflow] ✅ Node completed: stage-1 → stage-2
```

**SSE event:**
```json
{
  "type": "node.completed",
  "nodeId": "stage-1",
  "output": undefined  // ← НЕТ OUTPUT!
}
```

**Frontend console:**
```
[SSE] node.completed: stage-1 output: undefined  // ← ПРОБЛЕМА
```

**Node Details UI:**
```
Output: (пусто)
```

### После исправления:

**Backend logs:**
```
[Workflow] Node stage-1 output: {delayed: true, seconds: 20, ...}
[Workflow] ✅ Node completed: stage-1 → stage-2
```

**SSE event:**
```json
{
  "type": "node.completed",
  "nodeId": "stage-1",
  "output": {
    "delayed": true,
    "seconds": 20,
    "startTime": "2025-10-22T...",
    "endTime": "2025-10-22T..."
  }
}
```

**Frontend console:**
```
[SSE] node.completed: stage-1 output: {delayed: true, seconds: 20, ...}  // ← OK!
```

**Node Details UI:**
```
Output:
{
  "delayed": true,
  "seconds": 20,
  "startTime": "2025-10-22T14:15:16.123Z",
  "endTime": "2025-10-22T14:15:36.456Z"
}
```

## Тестирование

### Запустите workflow:

```bash
# Backend
cd /workspace/examples/integrations
pnpm c4c serve all

# Frontend
pnpm c4c serve ui --api-base http://localhost:3000
```

Откройте `http://localhost:3100/executions`

Запустите **Very Long Workflow**

### В Backend Terminal должны появиться логи:

```
[Workflow] Node start output: {logged: true, timestamp: "..."}
[Workflow] ✅ Node completed: start → stage-1
[Workflow] Node stage-1 output: {delayed: true, seconds: 20, ...}
[Workflow] ✅ Node completed: stage-1 → stage-2
[Workflow] Node stage-2 output: {delayed: true, seconds: 20, ...}
...
```

### В Browser Console:

```
[SSE] node.completed: start output: {logged: true, timestamp: "..."}
[SSE] node.completed: stage-1 output: {delayed: true, seconds: 20, ...}
[SSE] node.completed: stage-2 output: {delayed: true, seconds: 20, ...}
```

### В Node Details:

Кликните на любую выполненную ноду - должен отображаться output в реальном времени!

## Файлы изменены

**`packages/workflow/src/runtime.ts`:**
- Строка ~122-138: Используется `node.id` вместо `currentNodeId`
- Добавлен лог: `console.log(Node ${node.id} output:, nodeOutput)`

## Связанные исправления

Это исправление работает вместе с:
1. **Добавлением `output` в тип события** (`events.ts`)
2. **Передачей output в publish()** (два места в `runtime.ts`)
3. **Сохранением output на frontend** (`page.tsx`)

Все вместе обеспечивает real-time отображение output! ✅
