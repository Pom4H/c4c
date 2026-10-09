# c4c + Workflow SDK: tools → durable review

Это native Workflow SDK приложение, а не макет собственного runtime. Существующий c4c `define()` задаёт callable tools с input/output контрактами; явно объявленные steps вызывают их, workflow управляет последовательностью и typed approval hook. HTTP API демонстрирует прямой вызов тех же инструментов и интроспекцию.

```text
POST /api/reviews
    start(reviewChange)
       prepareReviewStep → c4c prepareReview tool
       approvalHook + durable sleep (до 7 дней)
       recordDecisionStep → c4c recordDecision tool
    getRun(runId).status / returnValue
```

Пример не запускает модель, не получает реальные тендеры и не переписывает SDK на Vercel. Он принимает отчёт `c4c check` от доверенного вызывающего, готовит review и сохраняет итог в SDK. Проверку реального upstream и применение `c4c update --expect <hash>` выполняет ваша CLI/CI-задача. Не выдавать переданный отчёт за самостоятельно проверенную совместимость API.

## 1. Запуск (Local World)

Из корня репозитория, Node 22.18+:

```sh
npm ci
npm run workflow:setup
cp examples/workflows/.env.example examples/workflows/.env.local
# Сгенерировать token (значение вставить только в локальный .env.local):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run workflow:dev
```

Задайте `C4C_ADMIN_TOKEN` длиной минимум 32 символа в `examples/workflows/.env.local`. Не добавляйте `.env.local` в git. Local World выбирается автоматически; .workflow-data также не коммитится.

Другой терминал:

```sh
npm run workflow:typecheck
npm run workflow:smoke
cd examples/workflows
npm run inspect
npm run web
```

Smoke отправляет синтетический отчёт, проверяет отсутствие анонимного доступа, JSON Schema инструментов, запуск, typed-hook resume и итог `approved`. Это проверка скомпилированного/запущенного SDK, **не** прямой вызов функции workflow с проигнорированной директивой. Smoke требует уже запущенный сервер.

В root CI пример не устанавливается и Next.js не собирается: туда включены только лёгкие tests чистой логики/выбора World. Прямые зависимости примера закреплены по официальному postgres example (workflow/world-postgres 5.0.1); перед воспроизводимым production deploy сохраните сгенерированный `examples/workflows/package-lock.json` и используйте `npm ci` в каталоге примера.

## 2. Self-hosted Postgres World

```sh
cd examples/workflows
cp .env.postgres.example .env.local
# Заполнить token, POSTGRES_PASSWORD и полный WORKFLOW_POSTGRES_URL.
# Один и тот же пароль должен стоять в POSTGRES_PASSWORD и URL.
docker compose --env-file .env.local up -d --wait
npm run db:migrate
npm run build
npm run start
```

`db:migrate` запускает **официальный** `bootstrap` из `@workflow/world-postgres`. Мы не создаём таблицы или runner сами. `instrumentation.ts` вызывает `world.start()` только для Postgres World, один раз при startup постоянного процесса.

Postgres URL сохраняет connection string в server env; не передаётся в браузер. PostgreSQL контейнер опубликован лишь на 127.0.0.1. На реальном self-hosted хосте выполните backup и ограничьте внешний доступ к служебным SDK callback endpoints `/.well-known/workflow/*` через private ingress/reverse proxy. Не выставляйте Local World или workflow web публично.

Проверка устойчивости, отдельно от обычного smoke:

1. Создать review, сохранить его runId и candidateHash.
2. В `npm run web -- --backend @workflow/world-postgres` дождаться создания approval hook.
3. Остановить только приложение, не PostgreSQL и не его volume.
4. Запустить тот же build с прежним `WORKFLOW_POSTGRES_URL`.
5. Возобновить тот же runId через approval API; проверить `completed` и предыдущие steps в SDK inspection.

Эту проверку нужно выполнить на вашей машине перед заявлением о restart/replay для выбранной версии. Наличие compose/config и unit-тесты её не заменяют.

## 3. Vercel World

Vercel project root: `examples/workflows`, с доступом к файлам выше корня (локальный `@c4c/core`). Сборка core требуется до Next build. Например, из корня примера install/build команды:

```sh
npm --prefix ../.. ci
npm --prefix ../.. run build
npm install
npm run build
```

После фиксации lock примера заменить `npm install` на `npm ci`. Задать server-side `C4C_ADMIN_TOKEN`, включить Fluid compute; **не задавать** `WORKFLOW_TARGET_WORLD=@workflow/world-postgres`. Vercel выбирает свой managed World автоматически. Инструменты по-прежнему могут работать с вашей PostgreSQL БД предметных данных внутри steps.

Служебные очереди, durable state и execution history в этом варианте принадлежат Vercel World; Postgres worker не запускается. Сам факт добавления кода не является подтверждённым Vercel deploy.

## API

Все `/api/*` требуют `Authorization: Bearer <C4C_ADMIN_TOKEN>`.

| Метод | Назначение |
|---|---|
| `GET /api/tools` | JSON Schema и описания явного списка инструментов |
| `POST /api/tools` | `{name, input}`: прямой вызов `prepareReview` или `recordDecision`, без durable выполнения |
| `POST /api/reviews` | `{integration, report}` → `202 {runId, statusUrl}` |
| `GET /api/reviews/:runId` | SDK status; результат только после `completed` |
| `POST /api/reviews/:runId/approval` | `{candidateHash, approved}` → native typed-hook resume |
| `DELETE /api/reviews/:runId` | SDK cancellation |

`report` содержит поля `previousHash`, `candidateHash`, `changes`, `truncated`, `generatorChanged` из `c4c check --json`. Дополнительные информационные поля отчёта игнорируются. Body ограничен 128 KiB. Ошибка схемы — 400; отсутствие ключа — 401; отсутствующий/закрытый hook — 409; недоступный backend — 503, а не успех.

Hook может ещё не существовать сразу после 202 создания run. Клиент повторяет approval после 409; 202 означает принятие события, не завершение workflow. Token hook включает runId и hash; устаревшая версия не продолжает другой review. После terminal run повторное approval отклоняется.

**Границы:** shared service-token, без tenant/RBAC/SSO; `start` не дедуплицирован по бизнес-requestId; approval не выполняет deploy. Для настоящего приложения нужны собственные identity/scopes/run ownership, event idempotency и side-effect keys. SDK не превращает произвольную сетевую запись в exactly-once.

## Структура

- `lib/tools.ts` — c4c callable tools и introspection; контракты в `contracts.ts`.
- `workflows/steps.ts` — статические SDK steps; ошибки контракта → FatalError.
- `workflows/review-change.ts` — control flow, hooks, durable sleep.
- `workflows/hooks.ts` — typed hook из SDK.
- `instrumentation.ts` / `lib/world.ts` — startup/проверка режима, не executor.
- `app/api` — авторизованные входы; никакого `eval`, сканирования exports или автоматического вызова неизвестных tools.

Документация: https://workflow-sdk.dev/docs/getting-started/next ; https://workflow-sdk.dev/worlds/postgres ; https://workflow-sdk.dev/worlds/vercel . Установленный пакет `workflow` также содержит документацию соответствующей версии.
