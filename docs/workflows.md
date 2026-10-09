# Workflows вокруг инструментов

## Граница ответственности

c4c — контракты, инструменты, интеграции и их описание. Сценарий — обычный TypeScript с `use workflow`; I/O — именованные `use step`. Runtime, очереди, журнал/replay, ожидания, hooks и inspection предоставляет Workflow SDK. Не создаём ещё одну БД runs, polling-daemon, DSL-интерпретатор или scheduler в c4c.

`define()` остаётся обычной вызываемой функцией с `.contract`. В `examples/workflows/lib/tools.ts` одни и те же функции вызываются HTTP-обработчиком, durable-шагом и описываются для внешнего клиента. `describeTools()` демонстрирует JSON Schema-интроспекцию; адаптер MCP/AI может использовать эти данные. Это НЕ новый готовый hosted MCP-сервер и не универсальное автоэкспонирование всех модулей.

## Почему не durable(tool)

SDK должен статически обнаружить настоящую функцию с `use step`. Обёртка в рантайме вокруг произвольного closure не заменяет его компиляцию. Поэтому `workflows/steps.ts` содержит явные типизированные функции, а `review-change.ts` — реальный workflow. Основная логика tools не зависит от runtime.

Внутри workflow — детерминированный control flow. Сеть, БД, LLM и обычные таймеры внутри step. Длительные паузы — SDK `sleep()` в workflow, не `setTimeout` и не незавершённый HTTP-response. Сериализуйте небольшие значения, а не функции, клиентские объекты, токены и полные большие документы.

## Контракт, ошибки и побочные эффекты

`ContractError` на входе/выходе инструмента и ошибка согласования hash переводятся в `FatalError`. Нельзя лечить их повтором. Настоящий provider adapter обязан отдельно классифицировать permission/business errors и transient failures. Повторы сети и `RetryableError` принадлежат SDK; вложенный самописный retry loop не добавлять.

Durable replay НЕ гарантирует exactly-once side effect у внешнего API. Для отправки, оплаты, записи и создания PR приложение использует provider idempotency key/уникальный бизнес-идентификатор и проверку фактического результата. Пример возвращает решение, а не выполняет финансовых операций и не деплоит SDK.

## Hooks и доверие

`defineHook({schema})` → `.create()` в workflow → `.resume()` из авторизованного endpoint. Токен связывает runId и candidateHash. Решение для другого snapshot не должно продолжать процесс. Токен — адрес маршрутизации, а не авторизация. `using` освобождает hook после решения/таймаута.

Пример защищён единым service token. Для продукта нужны membership/scopes и проверка принадлежности каждого run; внешние webhooks требуют подписи и дедупликации события. Не выдавайте пример с общим token за multi-tenant authorization. POST создания запуска не дедуплицируется по бизнес-задаче: добавьте это на уровне приложения, если повтор клиентского запроса должен ссылаться на тот же run.

## Deployment

| Режим | Исполнение/состояние | Что делает c4c |
|---|---|---|
| Local World | SDK dev backend | Обычный `next dev`; не заявлять restart-durable очередь |
| Vercel World | Managed SDK backend на Vercel | `withWorkflow`; обычные инструменты могут обращаться к PostgreSQL бизнес-данных |
| Postgres World | PostgreSQL + Graphile Worker в постоянном Node-сервере | Env, официальный bootstrap, `world.start()` при server startup |

Postgres World не помещать внутрь Vercel serverless функции. PostgreSQL для предметных данных и PostgreSQL как backend runtime — разные решения. На self-hosted хосте защитите служебные `/.well-known/workflow/*` endpoints от публичного вызова (private ingress/reverse proxy); `C4C_ADMIN_TOKEN` защищает лишь API этого примера. Не открывайте локальный backend/inspection UI в интернет.

На Vercel старые runs привязаны к deployment. Для self-hosted обновлений отдельно следуйте правилам версионирования выбранного SDK; не заменяйте исполняемый код старых процессов неявно. Собственные записи 0.1 несовместимы с SDK-журналом.

## Проверки

По умолчанию тестируем pure business logic и конфигурационные границы. Скомпилированные steps, pause/resume, сохранение после рестарта и реальные Vercel/Postgres подключения проверяются отдельно — процедура в примере. Это разные уровни доказательств.

Источники: https://workflow-sdk.dev/docs/getting-started/next ; https://workflow-sdk.dev/worlds/vercel ; https://workflow-sdk.dev/worlds/postgres ; https://workflow-sdk.dev/worlds/local ; https://github.com/vercel/workflow-examples/tree/main/postgres . Версии workflow/world-postgres 5.0.1 взяты из официального примера; перед обновлением проверять docs установленной версии.
