#!/bin/bash

# Script to integrate App A and App B with each other
# This creates a bidirectional integration

set -e

echo "🔄 C4C Cross-Integration Setup"
echo "================================"
echo ""

# Check if both apps are running
echo "📡 Checking if apps are running..."

if ! curl -s http://localhost:3001/openapi.json > /dev/null 2>&1; then
  echo "❌ App A (Task Manager) is not running on port 3001"
  echo "   Start it with: cd app-a && pnpm dev"
  exit 1
fi

if ! curl -s http://localhost:3002/openapi.json > /dev/null 2>&1; then
  echo "❌ App B (Notification Service) is not running on port 3002"
  echo "   Start it with: cd app-b && pnpm dev"
  exit 1
fi

echo "✅ Both apps are running!"
echo ""

# Integrate App B into App A
echo "📥 Step 1: Integrating App B (Notification Service) into App A (Task Manager)..."
cd ../app-a
c4c integrate http://localhost:3002/openapi.json --name notification-service

echo "✅ App A can now use notification-service procedures!"
echo ""

# Integrate App A into App B
echo "📥 Step 2: Integrating App A (Task Manager) into App B (Notification Service)..."
cd ../app-b
c4c integrate http://localhost:3001/openapi.json --name task-manager

echo "✅ App B can now use task-manager procedures!"
echo ""

echo "🎉 Integration complete!"
echo ""
echo "📚 What's available now:"
echo ""
echo "In App A (Task Manager):"
echo "  - notification-service.notifications.send"
echo "  - notification-service.notifications.list"
echo "  - notification-service.notifications.subscribe"
echo "  - notification-service.notifications.trigger.sent"
echo ""
echo "In App B (Notification Service):"
echo "  - task-manager.tasks.create"
echo "  - task-manager.tasks.list"
echo "  - task-manager.tasks.get"
echo "  - task-manager.tasks.update"
echo "  - task-manager.tasks.delete"
echo "  - task-manager.tasks.trigger.created"
echo "  - task-manager.tasks.trigger.updated"
echo ""
echo "💡 Next steps:"
echo "  1. Check generated files:"
echo "     - app-a/generated/notification-service/"
echo "     - app-b/generated/task-manager/"
echo "  2. Use procedures in workflows (see workflows/ folders)"
echo "  3. Test integration with scripts/test-integration.sh"
