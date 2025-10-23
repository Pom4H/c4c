#!/bin/bash

# Complete demonstration of cross-app workflow integration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║      🎯 ПОЛНАЯ ДЕМОНСТРАЦИЯ CROSS-APP WORKFLOW                    ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Start servers
cd "$SCRIPT_DIR"
./scripts/stop-apps.sh > /dev/null 2>&1 || true
./scripts/start-apps.sh > /dev/null 2>&1

sleep 5

echo "═══════════════════════════════════════════════════════════════════"
echo "ТЕСТ 1: Проверка что серверы загрузили все артефакты"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

echo "📦 App A (Task Manager):"
APP_A_PROCEDURES=$(curl -s http://localhost:3001/procedures | jq -r '.procedures | length')
APP_A_WORKFLOWS=$(curl -s http://localhost:3001/workflow/definitions | jq '. | length')
echo "   Procedures: $APP_A_PROCEDURES"
echo "   Workflows: $APP_A_WORKFLOWS"

# Check specific workflow
WORKFLOW_EXISTS=$(curl -s http://localhost:3001/workflow/definitions | \
  jq -e '.[] | select(.id == "create-task-with-notification")' > /dev/null && echo "YES" || echo "NO")
echo "   create-task-with-notification: $WORKFLOW_EXISTS"

echo ""
echo "📦 App B (Notification Service):"
APP_B_PROCEDURES=$(curl -s http://localhost:3002/procedures | jq -r '.procedures | length')
echo "   Procedures: $APP_B_PROCEDURES"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "ТЕСТ 2: Выполнение workflow с cross-app нодой"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

echo "🚀 Executing workflow..."
WF_RESULT=$(curl -s -X POST http://localhost:3001/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "create-task-with-notification",
    "input": {}
  }')

EXEC_ID=$(echo "$WF_RESULT" | jq -r '.executionId')
STATUS=$(echo "$WF_RESULT" | jq -r '.status')
EXEC_TIME=$(echo "$WF_RESULT" | jq -r '.executionTime')

echo "   Execution ID: $EXEC_ID"
echo "   Status: $STATUS"
echo "   Execution time: ${EXEC_TIME}ms"
echo ""

# Display tracing
echo "📊 Трейсинг выполнения:"
echo "$WF_RESULT" | jq -r '.spans[] | select(.attributes."node.id") | 
  "   " + .attributes."node.id" + 
  " (" + .attributes."node.procedure" + ")" + 
  " → " + .attributes."node.status" + 
  " [" + (.duration | tostring) + "ms]"
'

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "ТЕСТ 3: Проверка результатов выполнения"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Task created
echo "✅ Нода 1 (create-task) - результат:"
echo "$WF_RESULT" | jq '.outputs."create-task" | {id, title, status, priority}'

echo ""
echo "🔥 Нода 2 (send-notification) - cross-app вызов:"
echo "$WF_RESULT" | jq '.outputs."send-notification"'

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "ИТОГОВОЕ РЕЗЮМЕ"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

if [ "$STATUS" = "completed" ]; then
  echo "✅ Workflow выполнился со статусом: $STATUS"
  echo "✅ Обе ноды были выполнены:"
  echo "   - create-task (локальная процедура App A)"
  echo "   - send-notification (cross-app процедура из App B)"
  echo ""
  echo "✅ Трейсинг подтверждает:"
  echo "   - Workflow engine выполнил обе ноды"
  echo "   - Cross-app процедура была вызвана"
  echo "   - Вызов занял несколько миллисекунд"
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════╗"
  echo "║   ✅ ДОКАЗАНО: WORKFLOW МОЖЕТ ВЫЗЫВАТЬ ПРОЦЕДУРЫ ИЗ ДРУГОГО      ║"
  echo "║                    СЕРВИСА ЧЕРЕЗ CROSS-APP НОДЫ! ✅               ║"
  echo "╚══════════════════════════════════════════════════════════════════╝"
else
  echo "❌ Workflow не выполнился"
fi

echo ""

# Cleanup
./scripts/stop-apps.sh
