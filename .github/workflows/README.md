# GitHub Actions Workflows

Автоматизация CI/CD для tsdev проекта.

## Workflows

### deploy.yml

Основной workflow для build, test и deployment.

**Triggers:**
- Push в `main` или `develop`
- Pull requests в `main`
- Manual trigger через GitHub UI

**Jobs:**

1. **lint-and-test**
   - Устанавливает зависимости
   - Собирает все packages
   - Запускает linter
   - Запускает тесты
   - Загружает build artifacts

2. **build-docker**
   - Собирает Docker образ
   - Пушит в GitHub Container Registry
   - Поддерживает multi-platform (amd64, arm64)
   - Кэширует layers для быстрой сборки

3. **deploy-staging**
   - Деплоит в staging environment (develop branch)
   - Использует Kubernetes
   - Проверяет успешность deployment

4. **deploy-production**
   - Деплоит в production (main branch)
   - Требует manual approval
   - Запускает smoke tests
   - Отправляет уведомления в Slack

5. **deploy-fly** / **deploy-railway** / **deploy-lambda**
   - Альтернативные deployment targets
   - Параллельно с Kubernetes deployment

6. **security-scan**
   - Сканирует Docker образ на уязвимости
   - Загружает результаты в GitHub Security

## Secrets

Настройте следующие secrets в GitHub:

### Kubernetes Deployment
```
KUBE_CONFIG_STAGING    # Kubeconfig для staging cluster
KUBE_CONFIG_PROD       # Kubeconfig для production cluster
```

### Cloud Providers
```
AWS_ACCESS_KEY_ID      # AWS credentials для Lambda
AWS_SECRET_ACCESS_KEY
FLY_API_TOKEN          # Fly.io API token
RAILWAY_TOKEN          # Railway API token
```

### Notifications
```
SLACK_WEBHOOK          # Slack webhook для уведомлений
```

## Environments

Настройте environments в GitHub:

### staging
- URL: https://staging-api.yourdomain.com
- Branch: develop
- Auto-deployment: enabled

### production
- URL: https://api.yourdomain.com
- Branch: main
- Protection rules: 
  - Required reviewers: 1
  - Wait timer: 5 minutes

### fly-production / lambda-production
- Альтернативные production environments

## Usage

### Automatic Deployment

```bash
# Deploy to staging
git checkout develop
git push origin develop

# Deploy to production
git checkout main
git merge develop
git push origin main
```

### Manual Deployment

1. Перейти в Actions tab
2. Выбрать "Build and Deploy" workflow
3. Нажать "Run workflow"
4. Выбрать branch
5. Нажать "Run workflow"

### Rollback

```bash
# Через kubectl
kubectl rollout undo deployment/tsdev-api -n tsdev

# Или через GitHub
# Найти предыдущий успешный commit
# Trigger workflow с этим commit
```

## Monitoring

### Deployment Status

- GitHub Actions UI показывает статус всех jobs
- Notifications в Slack
- Можно настроить email notifications

### Logs

```bash
# GitHub Actions logs доступны в UI
# Или через gh CLI
gh run list
gh run view <run-id>
gh run view <run-id> --log
```

## Customization

### Добавить новый deployment target

1. Создать новый job в `deploy.yml`
2. Добавить secrets
3. Настроить environment (опционально)

Пример:
```yaml
deploy-my-platform:
  name: Deploy to My Platform
  runs-on: ubuntu-latest
  needs: lint-and-test
  if: github.ref == 'refs/heads/main'
  
  steps:
    - uses: actions/checkout@v4
    - name: Deploy
      run: my-deploy-command
      env:
        API_TOKEN: ${{ secrets.MY_PLATFORM_TOKEN }}
```

### Изменить условия deployment

```yaml
# Deploy только на main
if: github.ref == 'refs/heads/main'

# Deploy на main и staging branches
if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'

# Deploy только на tags
if: startsWith(github.ref, 'refs/tags/')

# Manual trigger только
if: github.event_name == 'workflow_dispatch'
```

## Troubleshooting

### Job failed

1. Проверить logs в GitHub Actions UI
2. Локально воспроизвести команды
3. Проверить secrets configuration

### Deployment timeout

- Увеличить `timeout-minutes` в job
- Проверить health checks
- Проверить resource limits

### Image not found

- Проверить что `build-docker` job успешно завершился
- Проверить image tags в Container Registry
- Проверить permissions для GITHUB_TOKEN

## Best Practices

1. **Всегда тестировать в staging перед production**
2. **Использовать protection rules для production**
3. **Мониторить deployment metrics**
4. **Иметь rollback план**
5. **Документировать изменения в deployment process**
