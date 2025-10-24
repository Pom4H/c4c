#!/bin/bash

# Start both apps in background

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_DIR="$ROOT_DIR/.pids"

echo "🚀 Starting c4c Cross-Integration Apps"
echo "========================================"

# Create PID directory
mkdir -p "$PID_DIR"

# Check if apps are already running
if [ -f "$PID_DIR/app-a.pid" ]; then
  PID=$(cat "$PID_DIR/app-a.pid")
  if kill -0 "$PID" 2>/dev/null; then
    echo "⚠️  App A is already running (PID: $PID)"
  else
    rm "$PID_DIR/app-a.pid"
  fi
fi

if [ -f "$PID_DIR/app-b.pid" ]; then
  PID=$(cat "$PID_DIR/app-b.pid")
  if kill -0 "$PID" 2>/dev/null; then
    echo "⚠️  App B is already running (PID: $PID)"
  else
    rm "$PID_DIR/app-b.pid"
  fi
fi

# Start App A
echo ""
echo "📦 Starting App A (Task Manager) on port 3001..."
cd "$ROOT_DIR/app-a"
# Set test tokens and URLs for cross-app integration
export NOTIFICATION_SERVICE_TOKEN="${NOTIFICATION_SERVICE_TOKEN:-test-notification-token}"
export NOTIFICATION_SERVICE_URL="${NOTIFICATION_SERVICE_URL:-http://localhost:3002}"
echo "   Environment: NOTIFICATION_SERVICE_URL=$NOTIFICATION_SERVICE_URL"
nohup node "$ROOT_DIR/../../../apps/cli/dist/bin.js" serve --port 3001 --root . > "$PID_DIR/app-a.log" 2>&1 &
APP_A_PID=$!
echo $APP_A_PID > "$PID_DIR/app-a.pid"
echo "   Started with PID: $APP_A_PID"

# Start App B
echo ""
echo "📦 Starting App B (Notification Service) on port 3002..."
cd "$ROOT_DIR/app-b"
# Set test tokens and URLs for cross-app integration
export TASK_MANAGER_TOKEN="${TASK_MANAGER_TOKEN:-test-task-manager-token}"
export TASK_MANAGER_URL="${TASK_MANAGER_URL:-http://localhost:3001}"
echo "   Environment: TASK_MANAGER_URL=$TASK_MANAGER_URL"
nohup node "$ROOT_DIR/../../../apps/cli/dist/bin.js" serve --port 3002 --root . > "$PID_DIR/app-b.log" 2>&1 &
APP_B_PID=$!
echo $APP_B_PID > "$PID_DIR/app-b.pid"
echo "   Started with PID: $APP_B_PID"

# Wait for servers to be ready
echo ""
echo "⏳ Waiting for servers to start..."

MAX_WAIT=30
WAIT_COUNT=0

# Wait for App A
while ! curl -s http://localhost:3001/openapi.json > /dev/null 2>&1; do
  if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo "❌ App A failed to start after ${MAX_WAIT}s"
    echo "   Check logs: cat $PID_DIR/app-a.log"
    exit 1
  fi
  echo -n "."
  sleep 1
  WAIT_COUNT=$((WAIT_COUNT + 1))
done
echo ""
echo "✅ App A ready (http://localhost:3001)"

# Wait for App B
WAIT_COUNT=0
while ! curl -s http://localhost:3002/openapi.json > /dev/null 2>&1; do
  if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo "❌ App B failed to start after ${MAX_WAIT}s"
    echo "   Check logs: cat $PID_DIR/app-b.log"
    exit 1
  fi
  echo -n "."
  sleep 1
  WAIT_COUNT=$((WAIT_COUNT + 1))
done
echo ""
echo "✅ App B ready (http://localhost:3002)"

echo ""
echo "🎉 Both apps are running!"
echo ""
echo "📊 Status:"
echo "   App A: http://localhost:3001 (PID: $APP_A_PID)"
echo "   App B: http://localhost:3002 (PID: $APP_B_PID)"
echo ""
echo "📝 Logs:"
echo "   App A: tail -f $PID_DIR/app-a.log"
echo "   App B: tail -f $PID_DIR/app-b.log"
echo ""
echo "🛑 Stop:"
echo "   ./scripts/stop-apps.sh"
