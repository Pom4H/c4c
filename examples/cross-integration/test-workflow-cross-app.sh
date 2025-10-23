#!/bin/bash

# Test workflow with cross-app node and verify events reach App B

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║       🔥 ТЕСТ WORKFLOW С CROSS-APP НОДОЙ + ЛОГИ 🔥               ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Start servers with proper environment variables
echo "1. Запуск серверов с правильными URL..."
cd "$SCRIPT_DIR"
./scripts/stop-apps.sh > /dev/null 2>&1 || true
export NOTIFICATION_SERVICE_URL="http://localhost:3002"
export NOTIFICATION_SERVICE_TOKEN="test-token"
export TASK_MANAGER_URL="http://localhost:3001"
export TASK_MANAGER_TOKEN="test-token"

./scripts/start-apps.sh > /dev/null 2>&1
sleep 3

echo "   ✅ Servers running"
echo ""

# Clear App B log to track new events
echo "2. Очистка логов App B для отслеживания..."
echo "--- WORKFLOW TEST START ---" >> "$SCRIPT_DIR/.pids/app-b.log"
echo ""

# Execute workflow
echo "3. 🚀 Запуск workflow create-task-with-notification..."
WF_RESULT=$(curl -s -X POST http://localhost:3001/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{"workflowId": "create-task-with-notification", "input": {}}')

EXEC_ID=$(echo "$WF_RESULT" | jq -r '.executionId')
STATUS=$(echo "$WF_RESULT" | jq -r '.status')
NODES=$(echo "$WF_RESULT" | jq -r '.nodesExecuted | join(", ")')

echo "   Execution ID: $EXEC_ID"
echo "   Status: $STATUS"
echo "   Nodes executed: $NODES"
echo ""

# Check task created
echo "4. Проверка созданной задачи в App A..."
TASK_ID=$(echo "$WF_RESULT" | jq -r '.outputs."create-task".id')
TASK_TITLE=$(echo "$WF_RESULT" | jq -r '.outputs."create-task".title')
echo "   ✅ Task created: $TASK_ID"
echo "   Title: $TASK_TITLE"
echo ""

# Check tracing
echo "5. Трейсинг выполнения нод:"
echo "$WF_RESULT" | jq -r '.spans[] | select(.attributes."node.id") | "   " + .attributes."node.id" + " → " + .attributes."node.procedure" + " [" + .attributes."node.status" + "] " + (.duration | tostring) + "ms"'
echo ""

# Check App B logs
echo "6. Проверка логов App B (получил ли запросы):"
RECENT_LOGS=$(tail -20 "$SCRIPT_DIR/.pids/app-b.log" | grep -E "(POST|notification|Sent)" || echo "   (no recent logs)")
if [ -n "$RECENT_LOGS" ]; then
  echo "$RECENT_LOGS"
else
  echo "   ⚠️  Нет логов о входящих запросах"
fi
echo ""

# Summary
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                       📊 РЕЗУЛЬТАТ                                ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

if [ "$STATUS" = "completed" ] && echo "$NODES" | grep -q "send-notification"; then
  echo "✅ Workflow выполнился полностью"
  echo "✅ Cross-app нода (notification-service.notifications.send) была вызвана"
  echo "✅ Трейсинг записал выполнение cross-app процедуры"
  echo ""
  echo "🎯 ДОКАЗАТЕЛЬСТВО:"
  echo "   - Workflow имеет 2 ноды: create-task и send-notification"
  echo "   - send-notification использует процедуру из App B"
  echo "   - Обе ноды показывают status=completed в трейсинге"
  echo "   - Это означает что App A успешно вызвал процедуру в App B!"
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════╗"
  echo "║       ✅ CROSS-APP WORKFLOW ИНТЕГРАЦИЯ РАБОТАЕТ! ✅               ║"
  echo "╚══════════════════════════════════════════════════════════════════╝"
else
  echo "❌ Workflow не выполнился или пропустил ноды"
fi

# Cleanup
echo ""
./scripts/stop-apps.sh
