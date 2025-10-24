#!/bin/bash

# Test script to verify cross-integration is working
# This script FAILS if integration doesn't work properly

set -e

echo "🧪 Testing C4C Cross-Integration"
echo "=================================="
echo ""

BASE_URL_A="http://localhost:3001"
BASE_URL_B="http://localhost:3002"

# Helper function to check for errors in response
check_error() {
  local response="$1"
  local test_name="$2"
  
  if echo "$response" | grep -q '"error"'; then
    echo "❌ FAILED: $test_name"
    echo "   Error in response: $response"
    exit 1
  fi
}

# Helper function to check non-empty value
check_not_empty() {
  local value="$1"
  local field_name="$2"
  local test_name="$3"
  
  if [ -z "$value" ] || [ "$value" = "null" ]; then
    echo "❌ FAILED: $test_name"
    echo "   Expected $field_name to be non-empty, got: '$value'"
    exit 1
  fi
}

# Test 1: Create a task in App A
echo "📝 Test 1: Creating a task in App A..."
TASK_RESPONSE=$(curl -s -X POST "$BASE_URL_A/rpc/tasks.create" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Integration Task",
    "description": "This task tests the integration between apps",
    "status": "todo",
    "priority": "high",
    "assignee": "user@example.com",
    "dueDate": "2025-11-01T10:00:00Z"
  }')

check_error "$TASK_RESPONSE" "Test 1: Create task"
TASK_ID=$(echo $TASK_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
check_not_empty "$TASK_ID" "task ID" "Test 1"
echo "✅ Task created with ID: $TASK_ID"
echo ""

# Test 2: List tasks from App B using integrated App A procedures
echo "📋 Test 2: Listing tasks from App B (using integrated App A)..."
TASKS_LIST=$(curl -s -X POST "$BASE_URL_B/rpc/task-manager.tasks.list" \
  -H "Content-Type: application/json" \
  -d '{}')

check_error "$TASKS_LIST" "Test 2: List tasks via integration"
TASKS_COUNT=$(echo $TASKS_LIST | grep -o '"id":"[^"]*"' | wc -l)

if [ "$TASKS_COUNT" -lt 1 ]; then
  echo "❌ FAILED: Test 2"
  echo "   Expected at least 1 task, got: $TASKS_COUNT"
  echo "   Response: $TASKS_LIST"
  exit 1
fi

echo "✅ App B successfully called App A! Found $TASKS_COUNT task(s)"
echo ""

# Test 3: Send notification from App A using integrated App B procedures
echo "📬 Test 3: Sending notification from App A (using integrated App B)..."
NOTIFICATION_RESPONSE=$(curl -s -X POST "$BASE_URL_A/rpc/notification-service.notifications.send" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test notification from App A via integration!",
    "channel": "push",
    "priority": "normal",
    "metadata": {
      "source": "app-a",
      "taskId": "'"$TASK_ID"'"
    }
  }')

check_error "$NOTIFICATION_RESPONSE" "Test 3: Send notification via integration"
NOTIF_ID=$(echo $NOTIFICATION_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
check_not_empty "$NOTIF_ID" "notification ID" "Test 3"
echo "✅ App A successfully called App B! Notification ID: $NOTIF_ID"
echo ""

# Test 4: List notifications in App B
echo "📨 Test 4: Listing notifications in App B..."
NOTIFS_LIST=$(curl -s -X POST "$BASE_URL_B/rpc/notifications.list" \
  -H "Content-Type: application/json" \
  -d '{}')

check_error "$NOTIFS_LIST" "Test 4: List notifications"
NOTIFS_COUNT=$(echo $NOTIFS_LIST | grep -o '"id":"[^"]*"' | wc -l)

if [ "$NOTIFS_COUNT" -lt 1 ]; then
  echo "❌ FAILED: Test 4"
  echo "   Expected at least 1 notification, got: $NOTIFS_COUNT"
  echo "   Response: $NOTIFS_LIST"
  exit 1
fi

echo "✅ Found $NOTIFS_COUNT notification(s) in App B"
echo ""

# Test 5: Update task in App A
echo "✏️  Test 5: Updating task in App A..."
UPDATE_RESPONSE=$(curl -s -X POST "$BASE_URL_A/rpc/tasks.update" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "'"$TASK_ID"'",
    "status": "in_progress",
    "description": "Updated via integration test"
  }')

check_error "$UPDATE_RESPONSE" "Test 5: Update task"
UPDATED_STATUS=$(echo $UPDATE_RESPONSE | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
check_not_empty "$UPDATED_STATUS" "updated status" "Test 5"

if [ "$UPDATED_STATUS" != "in_progress" ]; then
  echo "❌ FAILED: Test 5"
  echo "   Expected status 'in_progress', got: '$UPDATED_STATUS'"
  exit 1
fi

echo "✅ Task updated successfully to status: $UPDATED_STATUS"
echo ""

# Test 6: Get specific task from App B
echo "🔍 Test 6: Getting specific task from App B (using integrated App A)..."
TASK_DETAILS=$(curl -s -X POST "$BASE_URL_B/rpc/task-manager.tasks.get" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "'"$TASK_ID"'"
  }')

check_error "$TASK_DETAILS" "Test 6: Get task via integration"
TASK_STATUS=$(echo $TASK_DETAILS | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
check_not_empty "$TASK_STATUS" "task status" "Test 6"

if [ "$TASK_STATUS" != "in_progress" ]; then
  echo "❌ FAILED: Test 6"
  echo "   Expected status 'in_progress', got: '$TASK_STATUS'"
  exit 1
fi

echo "✅ App B retrieved task from App A! Status: $TASK_STATUS"
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║             ✅ ALL INTEGRATION TESTS PASSED! ✅              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Verified:"
echo "  ✓ App A can create tasks"
echo "  ✓ App B can list tasks from App A (found $TASKS_COUNT)"
echo "  ✓ App A can send notifications via App B"
echo "  ✓ App B can manage notifications (found $NOTIFS_COUNT)"
echo "  ✓ App A can update tasks"
echo "  ✓ App B can get specific tasks from App A"
echo ""
echo "🎉 Cross-integration is working perfectly!"
