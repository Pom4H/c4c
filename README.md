# c4c

**Типизированные инструменты и workflows вокруг них. Исполнение — Workflow SDK.**

c4c сохраняет контракты, интеграции и сценарии автоматизации. Мы заменяем **собственный рантайм**, а не отказываемся от workflows. Приложение не должно выбирать между обычной функцией и надёжным длительным процессом.

```text
контракт инструмента → обычная функция → use step → use workflow
                            ↑                         ↓
                 OpenAPI SDK / HTTP / AI      Workflow SDK runtime
                                              ├─ Vercel World
                                              └─ Postgres World
```

| Часть | Ответственность |
|---|---|
| `@c4c/core` | Вызываемые инструменты, проверка входа/выхода, доступные `.contract` для интроспекции. Без runtime-зависимостей. |
| `@c4c/cli` | OpenAPI → snapshot + самостоятельный Fetch SDK + Zod. Проверка изменений и review перед обновлением. |
| Workflow SDK | Durable execution, steps, hooks, ожидание, retries, состояние, история и observability. **Не наш второй движок.** |
| Приложение | Бизнес-сценарий, права доступа, идемпотентность внешних эффектов и предметные данные. |

Core и CLI можно использовать независимо от workflows. Сгенерированный SDK не импортирует c4c. Для процесса используйте нативные функции SDK, не строковый `engine.run()`.

## Инструмент — обычная функция

```ts
import { define } from '@c4c/core';
import { z } from 'zod';

export const normalizeProduct = define(
  { input: z.object({ sku: z.string(), name: z.string() }),
    output: z.object({ sku: z.string(), title: z.string() }) },
  ({ sku, name }) => ({ sku: sku.trim(), title: name.trim() }),
);
const product = await normalizeProduct({ sku: ' KKS-2 ', name: 'Cable chamber' });
```

Вход проверяется до handler, выход — после. Поддерживается Standard Schema v1; Zod — выбор приложения. Схемы доступны через `normalizeProduct.contract`. Нет обязательного сканирования модулей или скрытой авторизации.

## Тот же инструмент в durable workflow

```ts
import { normalizeProduct } from './tools';

export async function normalizeProductStep(input: { sku: string; name: string }) {
  'use step';
  return normalizeProduct(input);
}
export async function onboarding(input: { sku: string; name: string }) {
  'use workflow';
  const product = await normalizeProductStep(input);
  return { product };
}
// Server endpoint: await start(onboarding, [input]) from workflow/api.
```

Директивы остаются в именованных функциях: SDK компилирует и исполняет их. В полноценном примере ошибки контракта превращаются в `FatalError`, чтобы не повторять заведомо неверный шаг. Hooks, ожидания и отмена — тоже из SDK.

**[Запускаемый пример](examples/workflows/README.md):** c4c-инструмент готовит отчёт об изменении API → workflow ждёт подтверждение человека → другой инструмент фиксирует решение для того же hash. Есть HTTP-вызов инструментов, JSON Schema-интроспекция, запуск, статус, hook и отмена. Никакого изменения SDK без отдельного `c4c update --expect`.

```sh
# Node 22.18+. 0.2 пока не опубликована в npm; запускаем из checkout.
npm ci
npm run workflow:setup
cp examples/workflows/.env.example examples/workflows/.env.local
# Задайте в .env.local случайный C4C_ADMIN_TOKEN длиной минимум 32 символа.
npm run workflow:dev
# В другом терминале, после запуска приложения:
npm run workflow:smoke
```

### Два режима production

**Vercel:** `withWorkflow()` + автоматический Vercel World. PostgreSQL может оставаться БД бизнес-данных; собственный polling-worker не запускается.

**Self-hosted PostgreSQL:** `@workflow/world-postgres`, bootstrap схем SDK, постоянный Node-сервер и `world.start()` при его запуске. Это не режим Vercel serverless. Инструкции и Compose — [в примере](examples/workflows/README.md).

Для просмотра исполнений используется `workflow inspect` / `workflow web`, а на Vercel — его dashboard. Старая самописная визуализация не нужна для нового журнала исполнений.

## Интеграция — код, которым владеет приложение

```sh
npm run build
npm run c4c -- integrate examples/tender/openapi.json --name tender-demo
npm run c4c -- check integrations/tender-demo --json
```

Пример OpenAPI — фикстура, не работающий API тендерной площадки.

```text
integrations/tender-demo/
├── openapi.json       # snapshot, использованный при генерации
├── c4c.lock.json      # source, hash спецификации/SDK, версия генератора
└── sdk/              # Fetch-клиент, TypeScript, Zod, валидация
```

Генератор — закреплённый `@hey-api/openapi-ts`. Не разбираем его результат регулярками и не угадываем имена схем. `servers` и base path берутся из спецификации.

```ts
import { getTender } from './integrations/tender-demo/sdk/sdk.gen';
import { client } from './integrations/tender-demo/sdk/client.gen';
client.setConfig({ baseUrl: 'https://YOUR_PROVIDER/api' });
const { data } = await getTender({ path: { id: '123' }, throwOnError: true });
```

SDK требует Zod 4, но не c4c/codegen в production. Для нескольких компаний используйте разные клиентские экземпляры и авторизацию. Handwritten domain adapters остаются вне managed-директории и вызываются напрямую или из `use step`.

## Проверка и обновление

```sh
c4c check integrations/tender-demo --json
c4c update integrations/tender-demo --expect <candidateHash>
```

`check` только читает. Коды: `0` — без изменений; `2` — нужен review; `1` — невозможно проверить/источник недоступен. `--against ./candidate.json` проверяет подготовленный snapshot без смены upstream.

Обновление генерируется во временной директории. При ошибке прежняя интеграция сохраняется; изменение upstream после review или ручное редактирование SDK блокирует замену. [Подробности и восстановление](docs/integrations.md).

**Drift не доказывает совместимость:** структурный diff не проверяет смысл ответа, авторизацию и пагинацию. Это задача контрактных фикстур и ограниченных read-only проверок провайдера. Одобрение в примере workflow также не означает успешный деплой.

## Проверки и ограничения

```sh
npm run check          # лёгкие tests/types, включая логику review и выбор World
npm run test:codegen   # настоящий генератор → TS → Fetch mock
npm run workflow:typecheck # после workflow:setup
npm run workflow:build     # компиляция нативных workflow/step; отдельно от лёгкого CI
```

Automatic CI не ставит пример Next.js, не запускает БД, браузеры или модели. Полный native SDK smoke и проверка восстановления Postgres выполняются отдельно. Unit/mock-тест не доказывает живую доступность API или backend.

CLI поддерживает **OpenAPI 3.0/3.1 bundled JSON**. YAML/WSDL/SOAP не заявлены реализованными. Внешние `$ref` сначала bundle; dangling refs отклоняются. CLI — для доверенной машины, не публичный SSRF endpoint. HTTPS, без credentials/query/redirect, DNS проверяется при соединении. Private specs передавайте локальным файлом; секреты не коммитьте.

## Миграция

Старый engine и визуализатор сохранены в [archive/v0.1](https://github.com/Pom4H/c4c/tree/archive/v0.1). Возвращать собственный scheduler или хранить второй журнал workflow рядом с SDK не нужно. Но удаление workflow-возможностей было ошибкой направления — они остаются частью c4c на новом runtime. [Миграция](docs/migration.md) · [Архитектура workflows](docs/workflows.md).

MIT. Инструменты и предметная логика — ваши. Durable runtime — Workflow SDK.
