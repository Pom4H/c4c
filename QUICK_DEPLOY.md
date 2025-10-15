# Quick Deploy Guide

Быстрая памятка по развертыванию tsdev приложений.

## 🚀 Самый быстрый способ

### Option 1: Docker (локально или VPS)

```bash
cd examples/basic
docker-compose up -d
```

✅ Готово! API доступен на http://localhost:3000

---

### Option 2: Railway (бесплатно, <1 минута)

```bash
# Установить CLI
npm install -g @railway/cli

# Войти и развернуть
railway login
railway init
railway up
```

✅ Получите публичный URL автоматически

---

### Option 3: Fly.io (почти бесплатно, <2 минуты)

```bash
# Установить flyctl
curl -L https://fly.io/install.sh | sh

# Войти и развернуть
fly auth login
fly launch  # Автоматически найдет fly.toml
fly deploy
```

✅ URL: https://tsdev-api.fly.dev

---

## 📋 Checklist перед деплоем

### Минимальный (для тестирования)

```bash
# 1. Проверить что код собирается
pnpm install
pnpm -r build

# 2. Проверить что сервер запускается
cd examples/basic
pnpm dev

# 3. Проверить health check
curl http://localhost:3000/health
```

✅ Если все ОК - можно деплоить

### Production (для реальных приложений)

```bash
# 1. Линтер
pnpm lint

# 2. Тесты (когда добавите)
pnpm test

# 3. Environment variables
cp .env.example .env.production
# Заполнить значения

# 4. Security
# - Secrets не в git
# - CORS настроен
# - Rate limiting включен

# 5. Monitoring
# - Logging настроен
# - Health checks работают
# - Alerts настроены
```

---

## 🎯 По платформам

### Docker

```bash
cd examples/basic

# Запустить
docker-compose up -d

# Проверить
curl http://localhost:3000/procedures

# Остановить
docker-compose down
```

**Включает:**
- API сервер
- OpenTelemetry Collector
- Jaeger (traces)
- Prometheus (metrics)

---

### Kubernetes

```bash
# Создать namespace
kubectl create namespace tsdev

# Развернуть
kubectl apply -f examples/basic/k8s/deployment.yaml
kubectl apply -f examples/basic/k8s/ingress.yaml

# Проверить
kubectl get pods -n tsdev
kubectl port-forward -n tsdev svc/tsdev-api 3000:80
```

---

### AWS Lambda

```bash
cd examples/basic

# Установить Serverless
npm install -g serverless

# Развернуть
serverless deploy --stage production

# Тестировать
serverless invoke --function api --path test-event.json
```

---

### Fly.io

```bash
cd examples/basic

# Одна команда
fly deploy

# Масштабирование
fly scale count 3
fly scale memory 512
```

---

### Railway

```bash
cd examples/basic

# Через CLI
railway up

# Или через Git
# 1. Push в GitHub
# 2. Connect на railway.app
# 3. Auto-deploy
```

---

### Render

```bash
# 1. Push код в GitHub
# 2. Создать Web Service на render.com
# 3. Выбрать репозиторий
# 4. Render автоматически найдет render.yaml
# 5. Deploy
```

---

## 🔧 Endpoints после деплоя

Проверьте что эти endpoints работают:

```bash
# Health check
curl https://your-domain.com/health

# Procedures list
curl https://your-domain.com/procedures

# OpenAPI spec
curl https://your-domain.com/openapi.json

# Swagger UI
open https://your-domain.com/docs
```

---

## 📊 Мониторинг

### Базовый

```bash
# Logs (Docker)
docker-compose logs -f api

# Logs (Kubernetes)
kubectl logs -f -n tsdev -l app=tsdev-api

# Logs (Fly.io)
fly logs

# Logs (Railway)
railway logs
```

### Advanced

1. **Traces**: Jaeger UI на http://localhost:16686 (Docker Compose)
2. **Metrics**: Prometheus на http://localhost:9090
3. **Status**: `curl https://your-domain.com/status`

---

## ⚠️ Troubleshooting

### Container не запускается

```bash
# Проверить logs
docker logs <container-id>

# Проверить health
docker inspect <container-id> | grep Health -A 10
```

**Решение:** Проверить environment variables

---

### 502/503 ошибки

```bash
# Проверить что под запущен
kubectl get pods

# Проверить readiness probe
kubectl describe pod <pod-name>
```

**Решение:** 
- Проверить `/ready` endpoint
- Увеличить `initialDelaySeconds`

---

### High latency

```bash
# Проверить traces в Jaeger
open http://localhost:16686

# Найти медленные процедуры
```

**Решение:**
- Добавить caching с `withCache` policy
- Оптимизировать медленные handlers

---

## 🎓 Дальше

- **Полная документация**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **CI/CD setup**: [.github/workflows/README.md](./.github/workflows/README.md)
- **Kubernetes guide**: [examples/basic/k8s/README.md](./examples/basic/k8s/README.md)
- **Примеры**: [examples/basic/README.deploy.md](./examples/basic/README.deploy.md)

---

## 💡 Pro Tips

1. **Начинайте с Railway/Fly.io** для прототипов
2. **Переходите на Kubernetes** когда нужен контроль
3. **Используйте Lambda** для sporadic workloads
4. **Docker Compose** идеален для staging/dev environments

5. **Всегда настраивайте:**
   - Health checks
   - Logging
   - Monitoring
   - Graceful shutdown

6. **Production must-have:**
   - HTTPS
   - Rate limiting
   - Error tracking
   - Backups
