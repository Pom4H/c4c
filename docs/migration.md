# c4c: собственный runtime → Workflow SDK

## Исправление направления

Задача — сохранить workflows вокруг контрактных инструментов и заменить наш engine на Workflow SDK. Промежуточное сужение c4c до «core + SDK generator, без workflows» не соответствовало этой задаче. Core/codegen остаются небольшими и независимыми, но не определяют пределы продукта.

Старая 0.1 сохранена в `archive/v0.1`; codegen snapshots и механизм review 0.2 не удаляются. Новый runnable sample находится в `examples/workflows`. Это нативная интеграция с SDK, не восстановление старого интерпретатора и не drop-in compatibility layer.

| Раньше | Теперь |
|---|---|
| Procedure contract + handler | Callable `define()` tool и `.contract` |
| Самописный workflow runner | `use workflow` + `start()` из Workflow SDK |
| Runtime node dispatch | Именованные `use step` вызывают те же инструменты |
| Своя очередь, таймеры, replay | SDK runtime и выбранный World |
| Свои hooks/resume | `defineHook`, schema, `.create()` / `.resume()` |
| Самописный журнал/visualizer | `workflow inspect`, `workflow web`, Vercel observability |
| Неявный registry | Явный набор инструментов и интроспекция контрактов |

## Последовательность переноса потребителя 0.1

1. Сохранить доменные input/output контракты и права вызова; вынести handler в обычную функцию.
2. Обернуть I/O в явную `use step` функцию, не в динамический closure.
3. Перенести порядок, ветвление, параллелизм и ожидания в `use workflow`.
4. Обработчики событий проверяют identity, scopes и подпись, затем возобновляют типизированный hook.
5. Выбрать Vercel World либо long-lived Postgres World; схема runtime управляется официальным bootstrap.
6. Проверить start/status/approval/cancel, restart и side-effect idempotency на выбранном backend.
7. Старые runs завершить старым engine либо мигрировать через явно записанные бизнес-checkpoints. SDK не умеет читать журнал 0.1; не обещать автоматический replay старых процессов.

Функциональный паритет конкретного приложения (старые триггеры, auth-policy, artifacts, UI) требует его тестов. Добавленный пример доказывает структуру нового пути, но сам по себе не является проверкой всех прежних приложений.

## Что не меняется в интеграциях

`c4c integrate/check/update`, snapshot и generator pin, запрет затирать hand edits, `--expect <candidateHash>` остаются. Generated SDK не обязан импортировать c4c. Задача workflow может подготовить review и ожидать решения, но фактическое изменение интеграции выполняется отдельной авторизованной CI-задачей/CLI-командой с той же проверкой hash. Не записывать generated source в файловую систему Vercel-функции.
