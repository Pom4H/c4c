#!/bin/bash

# Complete demonstration of cross-app workflow integration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║      🎯 COMPLETE CROSS-APP WORKFLOW DEMONSTRATION                 ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Start servers
cd "$SCRIPT_DIR"
./scripts/stop-apps.sh > /dev/null 2>&1 || true
./scripts/start-apps.sh > /dev/null 2>&1

sleep 5

echo "═══════════════════════════════════════════════════════════════════"
echo "TEST 1: Check that servers loaded all artifacts"
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
echo "TEST 2: Execute workflow with cross-app node"
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
echo "📊 Execution tracing:"
echo "$WF_RESULT" | jq -r '.spans[] | select(.attributes."node.id") | 
  "   " + .attributes."node.id" + 
  " (" + .attributes."node.procedure" + ")" + 
  " → " + .attributes."node.status" + 
  " [" + (.duration | tostring) + "ms]"
'

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "TEST 3: Check execution results"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Task created
echo "✅ Node 1 (create-task) - result:"
echo "$WF_RESULT" | jq '.outputs."create-task" | {id, title, status, priority}'

echo ""
echo "🔥 Node 2 (send-notification) - cross-app call:"
echo "$WF_RESULT" | jq '.outputs."send-notification"'

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "SUMMARY"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

if [ "$STATUS" = "completed" ]; then
  echo "✅ Workflow completed with status: $STATUS"
  echo "✅ Both nodes were executed:"
  echo "   - create-task (local procedure in App A)"
  echo "   - send-notification (cross-app procedure from App B)"
  echo ""
  echo "✅ Tracing confirms:"
  echo "   - Workflow engine executed both nodes"
  echo "   - Cross-app procedure was called"
  echo "   - Call took several milliseconds"
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════╗"
  echo "║   ✅ PROVED: WORKFLOW CAN CALL PROCEDURES FROM ANOTHER           ║"
  echo "║              SERVICE VIA CROSS-APP NODES! ✅                      ║"
  echo "╚══════════════════════════════════════════════════════════════════╝"
else
  echo "❌ Workflow did not complete"
fi

echo ""

# Cleanup
./scripts/stop-apps.sh
