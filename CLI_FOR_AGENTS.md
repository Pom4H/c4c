# CLI для AI-агентов

> Как агенты могут работать с c4c dev server

## 3 команды

```bash
c4c dev status --json   # Проверить статус и порт
c4c dev logs --json     # Структурированные логи
c4c dev stop            # Остановка
```

## Быстрый старт

```bash
# Проверить статус
STATUS=$(c4c dev status --json)

# Запустить если не запущен
if [ "$(echo $STATUS | jq -r '.running')" != "true" ]; then
  c4c dev &
  sleep 2
fi

# Получить порт
PORT=$(c4c dev status --json | jq -r '.port')

# Использовать API
curl http://localhost:$PORT/procedures
```

## Детали

См. [AGENT_CLI.md](./AGENT_CLI.md) для полной спецификации и реализации.

**Время разработки:** 4-5 дней  
**Команд:** 3  
**Принцип:** Агент сам контролирует логику, CLI предоставляет инструменты
