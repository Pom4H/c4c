# Kubernetes Deployment Guide

Инструкции по развертыванию tsdev API в Kubernetes.

## Prerequisites

- Kubernetes cluster (1.25+)
- kubectl configured
- NGINX Ingress Controller установлен
- cert-manager для автоматических SSL сертификатов (опционально)

## Быстрый старт

### 1. Создать namespace

```bash
kubectl create namespace tsdev
kubectl config set-context --current --namespace=tsdev
```

### 2. Создать secret для Docker registry (если используете приватный registry)

```bash
kubectl create secret docker-registry github-registry \
  --docker-server=ghcr.io \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_PAT \
  --docker-email=YOUR_EMAIL
```

### 3. Применить конфигурацию

```bash
# Развернуть приложение
kubectl apply -f deployment.yaml

# Настроить ingress
kubectl apply -f ingress.yaml
```

### 4. Проверить развертывание

```bash
# Проверить pods
kubectl get pods -l app=tsdev-api

# Проверить сервис
kubectl get svc tsdev-api

# Проверить ingress
kubectl get ingress tsdev-api

# Логи
kubectl logs -l app=tsdev-api -f

# Описание pod (для debugging)
kubectl describe pod -l app=tsdev-api
```

## Мониторинг

### Проверить метрики HPA

```bash
kubectl get hpa tsdev-api-hpa
kubectl describe hpa tsdev-api-hpa
```

### Посмотреть events

```bash
kubectl get events --sort-by=.metadata.creationTimestamp
```

### Port forwarding для локального тестирования

```bash
kubectl port-forward svc/tsdev-api 3000:80

# Тестировать
curl http://localhost:3000/procedures
```

## Обновление приложения

### Rolling update

```bash
# Обновить образ
kubectl set image deployment/tsdev-api \
  api=ghcr.io/your-org/tsdev-api:v2.0.0

# Или применить новый манифест
kubectl apply -f deployment.yaml

# Проверить статус rollout
kubectl rollout status deployment/tsdev-api

# Откатить при необходимости
kubectl rollout undo deployment/tsdev-api
```

## Масштабирование

### Ручное масштабирование

```bash
kubectl scale deployment tsdev-api --replicas=5
```

### Auto-scaling уже настроен через HPA

HPA автоматически масштабирует от 2 до 10 реплик на основе CPU/Memory.

## Troubleshooting

### Pod не запускается

```bash
# Описание pod для деталей
kubectl describe pod <pod-name>

# Логи
kubectl logs <pod-name>

# Логи предыдущего контейнера (если pod перезапускался)
kubectl logs <pod-name> --previous

# Exec в pod для debugging
kubectl exec -it <pod-name> -- sh
```

### Проблемы с health checks

```bash
# Проверить endpoint напрямую
kubectl exec -it <pod-name> -- wget -O- http://localhost:3000/health

# Временно отключить health checks
kubectl patch deployment tsdev-api -p '{"spec":{"template":{"spec":{"containers":[{"name":"api","livenessProbe":null,"readinessProbe":null}]}}}}'
```

### Проблемы с ingress

```bash
# Проверить ingress controller логи
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller

# Проверить endpoints сервиса
kubectl get endpoints tsdev-api
```

## Secrets Management

### Создать secrets для sensitive данных

```bash
# Database URL
kubectl create secret generic tsdev-secrets \
  --from-literal=database-url='postgresql://user:pass@host:5432/db'

# Добавить в deployment.yaml:
# env:
# - name: DATABASE_URL
#   valueFrom:
#     secretKeyRef:
#       name: tsdev-secrets
#       key: database-url
```

## Backup & Recovery

### Backup конфигурации

```bash
kubectl get all -o yaml > backup.yaml
kubectl get configmap tsdev-config -o yaml > configmap-backup.yaml
kubectl get secret -o yaml > secrets-backup.yaml
```

## Удаление

```bash
# Удалить все ресурсы
kubectl delete -f deployment.yaml
kubectl delete -f ingress.yaml

# Или удалить namespace целиком
kubectl delete namespace tsdev
```

## Production Checklist

- [ ] Resource limits настроены
- [ ] Health checks работают
- [ ] HPA настроен
- [ ] Network policies применены
- [ ] Secrets для sensitive данных
- [ ] Logging настроен
- [ ] Monitoring/Alerting настроен
- [ ] Backup strategy определен
- [ ] SSL сертификаты настроены
- [ ] RBAC policies настроены
