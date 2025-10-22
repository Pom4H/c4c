# SSE и Procedures - Изменения

## Проблемы которые были исправлены

### 1. ❌ Polling каждые 2 секунды
**Было:** Frontend делал HTTP запрос каждые 2 секунды для получения списка executions
**Стало:** ✅ Frontend использует SSE для real-time updates

### 2. ❌ Workflow не запускались
**Было:** Ошибка "procedure custom.validateEvent not found in registry"
**Стало:** ✅ Созданы все необходимые custom процедуры + demo workflows

---

## Что изменилось

### Backend (`packages/adapters/src/workflow-http.ts`)

#### Новый SSE endpoint для списка executions:

```typescript
GET /workflow/executions-stream
```

Этот endpoint:
- Отправляет начальное состояние (`executions.initial`)
- Подписывается на все workflow события
- Отправляет обновления при каждом событии (`executions.update`)
- Keep-alive каждые 15 секунд

### Workflow Events (`packages/workflow/src/events.ts`)

Добавлена новая функция:

```typescript
export function subscribeToAllExecutions(listener: Listener): () => void
```

Позволяет подписаться на все workflow события (не только конкретного execution).

### Frontend (`apps/workflow/src/app/executions/page.tsx`)

**Было:**
```typescript
const interval = setInterval(loadExecutions, 2000); // ❌ Polling
```

**Стало:**
```typescript
const eventSource = new EventSource("/api/workflow/executions-stream"); // ✅ SSE

eventSource.addEventListener("executions.update", (event) => {
  const data = JSON.parse(event.data);
  setExecutions(data.executions);
  setStats(data.stats);
});
```

### Новые Процедуры (`examples/integrations/procedures/custom.ts`)

Созданы все custom.* процедуры для демо workflows:

1. ✅ `custom.log` - Логирование сообщений
2. ✅ `custom.logEvent` - Логирование событий
3. ✅ `custom.validateEvent` - Валидация событий
4. ✅ `custom.downloadFile` - Скачивание файлов (mock)
5. ✅ `custom.updateDatabase` - Обновление БД (mock)
6. ✅ `custom.finalize` - Финализация workflow
7. ✅ `custom.handleError` - Обработка ошибок
8. ✅ `custom.sendNotification` - Отправка уведомлений (mock)
9. ✅ `custom.processPDF` - Обработка PDF (mock)
10. ✅ `custom.parseSlackCommand` - Парсинг Slack команд
11. ✅ `custom.executeSlackCommand` - Выполнение Slack команд (mock)

### Новые Demo Workflows (`examples/integrations/workflows/demo-workflow.ts`)

Созданы простые рабочие workflows для тестирования:

1. **`simple-math-workflow`** - Базовые математические операции
   - Использует: `math.add`, `math.multiply`, `math.subtract`
   - Можно сразу запустить без внешних зависимостей

2. **`data-processing-workflow`** - Обработка данных с условиями
   - Использует: `data.fetch`, `data.process`, `data.save`
   - Демонстрирует condition nodes

3. **`parallel-workflow`** - Параллельное выполнение
   - Использует: `data.fetch`, `math.add`, `data.process`, `data.save`
   - Демонстрирует parallel execution

4. **`logging-workflow`** - Workflow с логированием
   - Использует: `custom.log`, `math.add`
   - Демонстрирует custom процедуры

---

## Как это работает

### SSE Flow для Executions List

```
1. Frontend открывает SSE: /api/workflow/executions-stream
   ↓
2. Frontend API route проксирует на backend
   ↓
3. Backend отправляет initial state:
   event: executions.initial
   data: { executions: [...], stats: {...} }
   ↓
4. Backend подписывается на все workflow события
   ↓
5. При каждом событии (node.started, workflow.completed и т.д.):
   - Backend отправляет событие
   - Backend отправляет обновленный список executions
   ↓
6. Frontend обновляет UI в real-time
```

### Преимущества SSE vs Polling

| Polling (было) | SSE (стало) |
|----------------|-------------|
| ❌ Запрос каждые 2 секунды | ✅ Событие только при изменении |
| ❌ Задержка до 2 секунд | ✅ Мгновенное обновление |
| ❌ Лишние HTTP запросы | ✅ Одно соединение |
| ❌ Нагрузка на сервер | ✅ Минимальная нагрузка |

---

## Тестирование

### 1. Запустить backend сервер:

```bash
cd /workspace/examples/integrations
pnpm c4c serve all
```

Сервер запустится на порту 3000 с workflow endpoints.

### 2. Запустить frontend UI:

```bash
pnpm c4c serve ui --api-base http://localhost:3000
```

UI запустится на порту 3100.

### 3. Протестировать простой workflow через API:

```bash
curl -X POST http://localhost:3000/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "simple-math-workflow",
    "input": {}
  }'
```

Или через CLI:

```bash
cd /workspace/examples/integrations
pnpm c4c exec --workflow simple-math-workflow
```

### 4. Открыть UI и проверить real-time updates:

```
http://localhost:3100/executions
```

- Запустите workflow
- Наблюдайте как execution появляется в списке в real-time (без перезагрузки страницы)
- Статистика обновляется автоматически

### 5. Протестировать SSE напрямую:

```bash
curl -N http://localhost:3000/workflow/executions-stream
```

Увидите события в формате SSE:
```
event: executions.initial
data: {"executions":[],"stats":{"total":0,"completed":0,"failed":0,"running":0},"timestamp":...}

event: heartbeat
data: {"timestamp":...}
```

---

## Доступные Workflows

### Готовые к запуску (без внешних зависимостей):

1. ✅ `simple-math-workflow` - Математические операции
2. ✅ `data-processing-workflow` - Обработка данных с условиями
3. ✅ `parallel-workflow` - Параллельное выполнение
4. ✅ `logging-workflow` - С кастомными процедурами логирования

### Требуют настройки триггеров:

5. ⚠️ `google-drive-monitor` - Требует Google Drive webhook
6. ⚠️ `slack-bot` - Требует Slack webhook
7. ⚠️ `complex-trigger-workflow` - Требует Google Drive webhook

---

## API Endpoints

### Backend (порт 3000)

```
GET  /workflow/executions           - Список executions (HTTP)
GET  /workflow/executions-stream    - Список executions (SSE) ← NEW!
GET  /workflow/executions/:id       - Детали execution
GET  /workflow/executions/:id/stream - События execution (SSE)
POST /workflow/execute              - Запустить workflow
GET  /workflow/definitions          - Список workflows
GET  /workflow/definitions/:id      - Детали workflow
```

### Frontend API Routes (порт 3100) - все проксируют на backend

```
GET  /api/workflow/executions-stream     ← NEW! Proxies SSE
GET  /api/workflow/executions
GET  /api/workflow/executions/:id
GET  /api/workflow/executions/:id/stream
POST /api/workflow/execute
GET  /api/workflow/definitions
GET  /api/workflow/definitions/:id
```

---

## Структура файлов

```
packages/
  adapters/src/
    workflow-http.ts              ← Добавлен SSE endpoint
  workflow/src/
    events.ts                     ← Добавлена subscribeToAllExecutions
    index.ts                      ← Экспортирована новая функция

apps/
  workflow/src/
    app/executions/page.tsx       ← Заменен polling на SSE
    app/api/workflow/
      executions-stream/route.ts  ← NEW! Proxy для SSE

examples/
  integrations/
    procedures/
      custom.ts                   ← NEW! Все custom процедуры
      math.ts                     ← Существующие
      data.ts                     ← Существующие
    workflows/
      demo-workflow.ts            ← NEW! Demo workflows
      trigger-example.ts          ← Существующие (требуют webhooks)
      index.ts                    ← Обновлен список workflows
```

---

## Troubleshooting

### Workflow не запускается

Проверьте что все процедуры загружены:
```bash
curl http://localhost:3000/procedures
```

### SSE не работает

1. Проверьте что backend запущен: `curl http://localhost:3000/health`
2. Проверьте SSE endpoint: `curl -N http://localhost:3000/workflow/executions-stream`
3. Проверьте browser console на ошибки

### UI не обновляется

1. Откройте DevTools → Network → EventStream
2. Проверьте что соединение к `/api/workflow/executions-stream` активно
3. Проверьте что события приходят при запуске workflow

---

## Следующие шаги

1. ✅ SSE для executions list - **Готово**
2. ✅ Создать custom процедуры - **Готово**
3. ✅ Создать demo workflows - **Готово**
4. 🔄 Протестировать через UI
5. 🔄 Протестировать через CLI
6. 📝 Добавить больше demo workflows при необходимости
