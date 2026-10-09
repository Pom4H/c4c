# 0.1 → 0.2

Это осознанная breaking-переработка, не обещание drop-in compatibility.

## Сохранена идея

Контракт описывается один раз, функция типизирована и проверяет внешние границы. Внешний API превращается в код, которым владеет приложение. CLI остаётся главным инструментом разработки интеграций.

## Удалено из активного дерева

- Собственный workflow runtime, исполнение по строковым именам и обязательный registry.
- Next.js visualizer, React hooks, хранение executions и связанных spans.
- Универсальные HTTP/RPC/webhook серверы и автоматическое определение triggers по названиям.
- Дублирующая генерация procedures поверх уже сгенерированного SDK, regex-разбор исходников, fallback на непроверенные схемы.
- Глобальные retry/auth/rate-limit policies. Старый limiter был process-local; retry повторял любые ошибки; tracing мог копировать metadata в span. Теперь приложение явно владеет этими решениями.
- Сайт документации со старым API, монорепозиторные примеры и ненужные зависимости UI. История и branch archive/v0.1 сохранены.

## Использование

Вместо `{ contract, handler }` + `engine.run('operation', input)`:

```ts
const operation = define({ input, output }, handler);
await operation(value);
```

Вместо глобального `ExecutionContext` передавайте зависимости через замыкание/factory. Для разных компаний создавайте изолированные экземпляры клиента с отдельной авторизацией. Для workflows — явные шаги выбранного durable runtime, не bridge из одного workflow DSL в другой.

Для HTTP/MCP/AI tools используйте `operation.contract.input/output` и саму функцию. Экспонирование должно быть явным; наличие схемы не является авторизацией. Проверьте совместимость выбранного SDK со Standard Schema или используйте его официальный адаптер.

Старый `c4c integrate` заменён командами `integrate`, `check`, `update`. Generated SDK использует Fetch/Zod напрямую, не @c4c/core.

## Чего нельзя обещать

c4c не получила полноценного WSDL/SOAP генератора и не чинит изменившееся API автоматически. Structural diff консервативен: изменения требуют просмотра, он не доказывает backward compatibility. Автоматический PR и расписание — задача GitHub/агента поверх read-only `check`, а не новый daemon внутри c4c.
