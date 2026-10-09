# c4c

**Контракты, которые вызываются как функции. Интеграции, которые обновляются через проверяемый diff.**

c4c 0.2 — два независимых пакета. Не платформа автоматизации и не ещё один workflow engine.

| Пакет | Зачем |
|---|---|
| `@c4c/core` | Входной контракт + функция + выходной контракт. Без runtime-зависимостей. |
| `@c4c/cli` | OpenAPI → сохранённая спецификация + самостоятельный Fetch SDK + Zod. Проверка drift и обновление после review. Только dev tooling. |

Можно пользоваться любым из них отдельно. Сгенерированный SDK не импортирует c4c.

## Контракт — обычная функция

```ts
import { define } from '@c4c/core';
import { z } from 'zod';

export const normalizeProduct = define(
  {
    input: z.object({ sku: z.string(), name: z.string() }),
    output: z.object({ sku: z.string(), title: z.string() }),
  },
  ({ sku, name }) => ({ sku: sku.trim(), title: name.trim() }),
);

const product = await normalizeProduct({ sku: ' KKS-2 ', name: 'Cable chamber' });
```

Вход проверяется **до** handler, выход — **после**. Асинхронные схемы и преобразования сохраняют типы. Схемы доступны в `normalizeProduct.contract`: их можно передать своему HTTP/MCP/AI-адаптеру. Автоэкспонирования, скрытого контекста, строкового `engine.run()` и сканирования модулей нет.

Поддерживается структурный [Standard Schema v1](https://standardschema.dev/schema): Zod — выбор приложения, не обязательная зависимость core. Авторизация, workflow, повторы, rate limiting и tracing остаются в приложении.

## Интеграция — код, которым владеет приложение

Версия 0.2 пока живёт в GitHub; публикация npm не выполнялась. Из checkout (Node 22.18+):

```sh
npm install
npm run build
npm run c4c -- integrate examples/tender/openapi.json --name tender-demo
npm run c4c -- check integrations/tender-demo --json
```

Пример — **фикстура**, не действующий API тендерной площадки. Для настоящего провайдера передайте его публичный HTTPS OpenAPI URL или локальный JSON-файл.

```text
integrations/tender-demo/
├── openapi.json       # единственный снимок, использованный при генерации
├── c4c.lock.json      # источник, hash спецификации и SDK, версия генератора
└── sdk/              # Fetch-клиент, TypeScript, Zod и проверка ответов
```

SDK генерируется закреплённым `@hey-api/openapi-ts`, **не** нашим самописным генератором. Не разбираем результат повторно регулярками и не угадываем имена схем. `servers` и base path берутся из спецификации, а не из URL её документации.

```ts
import { getTender } from './integrations/tender-demo/sdk/sdk.gen';
import { client } from './integrations/tender-demo/sdk/client.gen';

// Для нескольких компаний используйте отдельные client instances с отдельной
// авторизацией. Здесь показан только одно-пользовательский пример.
client.setConfig({ baseUrl: 'https://YOUR_PROVIDER/api' });
const { data } = await getTender({ path: { id: '123' }, throwOnError: true });
```

Для SDK нужна Zod 4 в приложении; c4c и его codegen-зависимости в production не нужны. Адаптер предметной области пишется **снаружи** managed-директории и вызывает обычные SDK-функции. Тот же код можно вызвать из Vercel Workflow, Bun, очереди задач или CLI.

## Проверка и обновление

```sh
# Только читает. Не заменяет клиент и не запускает бизнес-операции провайдера.
c4c check integrations/tender-demo --json

# После просмотра отчёта. Вставьте candidateHash из check.
c4c update integrations/tender-demo --expect <candidateHash>
```

`--against ./candidate.json` позволяет сравнить и принять подготовленный снимок, не меняя сохранённый адрес upstream.

| Exit code `check` | Значение |
|---|---|
| 0 | Снимок и версия генератора не изменились |
| 2 | Есть изменения; требуется review |
| 1 | Ошибка, источник недоступен, повреждён/изменён managed-код |

При update клиент сначала генерируется во временную директорию. Ошибка генератора оставляет прежнюю интеграцию. Обновление не принимается, если источник изменился после review, SDK вручную отредактирован или другой процесс уже обновляет его. [Границы гарантий и восстановление](docs/integrations.md).

**Drift не равен доказанному breaking change.** Отчёт показывает изменённые JSON-пути и добавленные/удалённые операции. Даже добавление поля требует просмотра. Он не доказывает корректность авторизации, пагинации и смысла ответа. Для этого — контрактные фикстуры и небольшие read-only проверки конкретного провайдера.

## Проверки

```sh
npm run check          # type inference, build, Node unit/transaction/CLI tests
npm run test:codegen   # реальный codegen → TS-check → вызов SDK на Fetch mock
```

Никаких браузеров, БД, моделей и GPU. Тест с настоящим codegen отделён от быстрых offline-тестов. Результат mock-теста не выдаётся за доступность живого тендерного API.

## Сознательно ограничено

OpenAPI **3.0/3.1, bundled JSON**. Внешние `$ref` нужно заранее включить в документ; dangling refs отклоняются. YAML, WSDL/SOAP и автоматически угаданные webhooks не заявлены поддержанными. Предыдущие рассуждения о WSDL были идеей, не реализацией.

CLI предназначен для доверенной машины разработчика/CI, не для публичного endpoint загрузки произвольных спецификаций. URL — HTTPS, без credentials/query, редиректы не выполняются; адреса DNS проверяются при соединении. Приватные спецификации скачивайте своим авторизованным инструментом и передавайте локальным файлом. Не коммитьте секреты в спецификации/examples.

## Что стало с 0.1

Старый workflow runtime, Next.js visualizer, React hooks, registry, policies и прежние docs сохранены в [archive/v0.1](https://github.com/Pom4H/c4c/tree/archive/v0.1). В main нет слоя совместимости ради неиспользуемого API. [Миграция и причины](docs/migration.md).

MIT. Имя c4c сохранено. Свобода приложения тоже.
