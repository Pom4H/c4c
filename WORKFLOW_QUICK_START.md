# 🔄 Workflow Quick Start

## Концепция за 30 секунд

**Процедуры с input/output → автоматически становятся workflow-нодами!**

```typescript
// 1. У вас есть процедура
export const createUser: Procedure = {
  contract: {
    name: "users.create",
    input: z.object({ name, email }),
    output: z.object({ id, name, email })
  },
  handler: async (input) => { ... }
};

// 2. Она автоматически становится нодой для workflow!
```

## Попробуй за 3 минуты

### Шаг 1: Запусти сервер

```bash
npm run dev:http
```

### Шаг 2: Открой визуальную палитру

```bash
open http://localhost:3000/workflow/palette
```

Увидишь все твои процедуры как drag-and-drop ноды!

### Шаг 3: Выполни workflow

```bash
curl -X POST http://localhost:3000/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": {
      "id": "test-workflow",
      "name": "Test Workflow",
      "version": "1.0.0",
      "startNode": "add-numbers",
      "nodes": [
        {
          "id": "add-numbers",
          "type": "procedure",
          "procedureName": "math.add",
          "config": { "a": 10, "b": 5 },
          "next": "multiply-result"
        },
        {
          "id": "multiply-result",
          "type": "procedure",
          "procedureName": "math.multiply",
          "config": { "a": 2 },
          "next": null
        }
      ]
    },
    "input": {}
  }'
```

Результат: `(10 + 5) * 2 = 30`

## Что дальше?

- 📖 Полная документация: [WORKFLOW_SYSTEM.md](./WORKFLOW_SYSTEM.md)
- 🎨 Примеры workflows: `src/workflow/examples.ts`
- 🔧 API endpoints: `/workflow/*`

## Use Cases

- ✅ **Low-code platform** - визуальное программирование
- ✅ **API orchestration** - цепочки API вызовов
- ✅ **Data pipelines** - ETL процессы
- ✅ **Business automation** - бизнес-процессы
- ✅ **Testing scenarios** - integration тесты

## Философия

**Традиционный подход:**
- Пишешь API endpoint
- Отдельно создаёшь workflow node
- Синхронизируешь вручную

**tsdev подход:**
- Пишешь contract ОДИН раз
- Получаешь API + workflow node АВТОМАТИЧЕСКИ
- Никакой синхронизации!

**"Write once — describe forever, program visually!"** ✨
