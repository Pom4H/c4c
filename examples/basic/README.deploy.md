# Deployment Examples

Практические примеры развертывания tsdev API на разных платформах.

## Содержание

- [Docker](#docker)
- [Docker Compose](#docker-compose)
- [Kubernetes](#kubernetes)
- [AWS Lambda (Serverless)](#aws-lambda)
- [Fly.io](#flyio)
- [Railway](#railway)
- [Render](#render)

---

## Docker

### Быстрый старт

```bash
# Собрать образ
docker build -t tsdev-api:latest -f Dockerfile ../..

# Запустить контейнер
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  --name tsdev-api \
  tsdev-api:latest

# Проверить
curl http://localhost:3000/health
curl http://localhost:3000/procedures
```

### Production с docker-compose

```bash
# Запустить все сервисы (API + OpenTelemetry + Jaeger)
docker-compose up -d

# Проверить логи
docker-compose logs -f api

# Масштабировать
docker-compose up -d --scale api=3

# Остановить
docker-compose down
```

**Доступные сервисы:**
- API: http://localhost:3000
- Jaeger UI: http://localhost:16686
- Prometheus: http://localhost:9090
- OTEL Collector Health: http://localhost:13133

---

## Kubernetes

### Развертывание

```bash
# Создать namespace
kubectl create namespace tsdev

# Применить конфигурацию
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/ingress.yaml

# Проверить
kubectl get pods -n tsdev -l app=tsdev-api
kubectl get svc -n tsdev tsdev-api
kubectl get hpa -n tsdev tsdev-api-hpa

# Логи
kubectl logs -n tsdev -l app=tsdev-api -f
```

### Port forwarding для тестирования

```bash
kubectl port-forward -n tsdev svc/tsdev-api 3000:80

# Тестировать
curl http://localhost:3000/procedures
```

### Обновление

```bash
# Rolling update
kubectl set image deployment/tsdev-api \
  api=ghcr.io/your-org/tsdev-api:v2.0.0 \
  -n tsdev

# Проверить статус
kubectl rollout status deployment/tsdev-api -n tsdev

# Откат
kubectl rollout undo deployment/tsdev-api -n tsdev
```

---

## AWS Lambda

### Установка

```bash
# Установить Serverless Framework
npm install -g serverless

# Установить плагины
pnpm install --save-dev \
  serverless-esbuild \
  serverless-offline \
  @types/aws-lambda
```

### Локальное тестирование

```bash
# Запустить локально
serverless offline

# API доступен на http://localhost:3000
curl http://localhost:3000/dev/procedures
curl -X POST http://localhost:3000/dev/rpc/users.create \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
```

### Развертывание

```bash
# Развернуть в dev
serverless deploy --stage dev

# Развернуть в production
serverless deploy --stage production

# Посмотреть информацию
serverless info --stage production

# Вызвать функцию
serverless invoke --function api \
  --path test-event.json \
  --stage production

# Логи
serverless logs --function api --tail --stage production
```

### Удаление

```bash
serverless remove --stage dev
```

**test-event.json:**
```json
{
  "path": "/procedures",
  "httpMethod": "GET",
  "headers": {
    "Content-Type": "application/json"
  },
  "requestContext": {
    "requestId": "test-123",
    "identity": {
      "sourceIp": "127.0.0.1"
    }
  }
}
```

---

## Fly.io

### Установка flyctl

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### Первое развертывание

```bash
# Войти
fly auth login

# Создать приложение
fly launch
# Выберите регион, конфигурация уже в fly.toml

# Развернуть
fly deploy

# Открыть в браузере
fly open

# Посмотреть статус
fly status

# Логи
fly logs
```

### Масштабирование

```bash
# Масштабировать машины
fly scale count 3

# Изменить VM размер
fly scale vm shared-cpu-1x --memory 512

# Проверить
fly scale show
```

### Secrets

```bash
# Добавить секреты
fly secrets set DATABASE_URL=postgresql://...
fly secrets set API_KEY=secret123

# Посмотреть
fly secrets list
```

### Регионы

```bash
# Добавить регион
fly regions add lhr  # London

# Посмотреть регионы
fly regions list
```

---

## Railway

### Развертывание через CLI

```bash
# Установить Railway CLI
npm install -g @railway/cli

# Войти
railway login

# Инициализировать
railway init

# Связать с проектом
railway link

# Развернуть
railway up

# Посмотреть логи
railway logs
```

### Развертывание через Git

1. Создать проект на railway.app
2. Подключить GitHub репозиторий
3. Railway автоматически деплоит при push
4. Конфигурация берется из `railway.toml`

### Environment Variables

```bash
# Добавить через CLI
railway variables set NODE_ENV=production
railway variables set LOG_LEVEL=info

# Или через dashboard на railway.app
```

---

## Render

### Развертывание через dashboard

1. Создать аккаунт на render.com
2. New > Web Service
3. Подключить GitHub репозиторий
4. Render автоматически находит `render.yaml`
5. Deploy

### Развертывание через CLI (опционально)

```bash
# Установить render-cli (если нужно)
npm install -g render-cli

# Войти
render login

# Развернуть
render deploy
```

### Environment Variables

Добавить в dashboard или в `render.yaml`:

```yaml
envVars:
  - key: DATABASE_URL
    sync: false  # Не коммитить в git
  - key: API_KEY
    generateValue: true  # Сгенерировать случайное значение
```

---

## Сравнение платформ

| Критерий | Docker | K8s | Lambda | Fly.io | Railway | Render |
|----------|--------|-----|--------|--------|---------|--------|
| **Сложность** | 🟢 Low | 🔴 High | 🟡 Medium | 🟢 Low | 🟢 Low | 🟢 Low |
| **Контроль** | 🟡 Medium | 🟢 Full | 🔴 Limited | 🟡 Medium | 🔴 Limited | 🔴 Limited |
| **Стоимость** | 💰 Self-hosted | 💰💰💰 High | 💰 Pay-per-use | 💰💰 Medium | 💰 Free tier | 💰 Free tier |
| **Масштабирование** | Manual | Auto | Auto | Auto | Auto | Auto |
| **Cold starts** | ❌ No | ❌ No | ✅ Yes | 🟡 Optional | ✅ Yes | ❌ No |
| **Best for** | Dev/Self-hosted | Enterprise | Sporadic load | Apps | Prototypes | Web apps |

---

## Production Checklist

Перед production деплоем:

### Код

- [ ] Build успешно: `pnpm build`
- [ ] Linter проходит: `pnpm lint`
- [ ] Тесты зеленые: `pnpm test`
- [ ] Нет TODO/FIXME в критичных местах

### Конфигурация

- [ ] Environment variables настроены
- [ ] Secrets для чувствительных данных
- [ ] Health checks работают (`/health`, `/ready`)
- [ ] Graceful shutdown реализован
- [ ] CORS правильно настроен

### Мониторинг

- [ ] Logging настроен (structured logs)
- [ ] Error tracking (Sentry/Datadog)
- [ ] OpenTelemetry экспортирует traces
- [ ] Metrics endpoint доступен
- [ ] Alerts настроены

### Безопасность

- [ ] Rate limiting включен
- [ ] Input validation через Zod
- [ ] HTTPS включен
- [ ] Security headers настроены
- [ ] Secrets не в git

### Performance

- [ ] Caching strategy определена
- [ ] Database connection pooling
- [ ] Compression включен
- [ ] CDN для статики (если есть)

### Backup & Recovery

- [ ] Backup strategy для данных
- [ ] Disaster recovery план
- [ ] Rollback strategy протестирован

---

## Troubleshooting

### Проблема: Container не запускается

```bash
# Проверить логи
docker logs <container-id>

# Запустить интерактивно
docker run -it tsdev-api:latest sh

# Проверить health check
docker inspect --format='{{json .State.Health}}' <container-id>
```

### Проблема: High memory usage

```bash
# Node.js heap limit
docker run -e NODE_OPTIONS="--max-old-space-size=512" tsdev-api:latest

# Kubernetes limits
# Установить в deployment.yaml:
resources:
  limits:
    memory: 512Mi
```

### Проблема: Slow cold starts (Lambda)

- Используйте provisioned concurrency
- Минимизируйте bundle size
- Lazy load зависимостей
- Кэшируйте registry между вызовами

### Проблема: 504 Gateway Timeout

- Увеличьте timeout в ingress/load balancer
- Оптимизируйте медленные процедуры
- Используйте async processing для длинных задач

---

## Дополнительные ресурсы

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Kubernetes Deployment Strategies](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Serverless Framework Docs](https://www.serverless.com/framework/docs)
- [Fly.io Docs](https://fly.io/docs/)
- [Railway Docs](https://docs.railway.app/)
- [Render Docs](https://render.com/docs)
