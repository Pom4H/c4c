#!/bin/bash

# Stop both apps

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_DIR="$ROOT_DIR/.pids"

echo "🛑 Stopping c4c Cross-Integration Apps"
echo "======================================="

STOPPED=0

# Stop App A
if [ -f "$PID_DIR/app-a.pid" ]; then
  PID=$(cat "$PID_DIR/app-a.pid")
  if kill -0 "$PID" 2>/dev/null; then
    echo "Stopping App A (PID: $PID)..."
    kill "$PID"
    rm "$PID_DIR/app-a.pid"
    STOPPED=$((STOPPED + 1))
  else
    echo "App A is not running"
    rm "$PID_DIR/app-a.pid"
  fi
else
  echo "App A is not running (no PID file)"
fi

# Stop App B
if [ -f "$PID_DIR/app-b.pid" ]; then
  PID=$(cat "$PID_DIR/app-b.pid")
  if kill -0 "$PID" 2>/dev/null; then
    echo "Stopping App B (PID: $PID)..."
    kill "$PID"
    rm "$PID_DIR/app-b.pid"
    STOPPED=$((STOPPED + 1))
  else
    echo "App B is not running"
    rm "$PID_DIR/app-b.pid"
  fi
else
  echo "App B is not running (no PID file)"
fi

if [ $STOPPED -eq 0 ]; then
  echo ""
  echo "ℹ️  No apps were running"
else
  echo ""
  echo "✅ Stopped $STOPPED app(s)"
fi

# Cleanup
if [ -d "$PID_DIR" ]; then
  rm -f "$PID_DIR"/*.log
  rmdir "$PID_DIR" 2>/dev/null || true
fi
