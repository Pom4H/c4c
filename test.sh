#!/bin/bash

set -e

echo "🧪 Testing tsdev prototype"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo ""

# Build
echo "🔨 Building TypeScript..."
npm run build
echo ""

# Start HTTP server in background
echo "🚀 Starting HTTP server..."
npm run dev:http &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test HTTP endpoints
echo "🧪 Testing HTTP endpoints..."
echo ""

echo "1. Health check"
curl -s http://localhost:3000/health
echo ""
echo ""

echo "2. List procedures"
curl -s http://localhost:3000/procedures | head -20
echo ""
echo ""

echo "3. Create user"
RESPONSE=$(curl -s -X POST http://localhost:3000/rpc/users.create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com"}')
echo "$RESPONSE"
USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo ""
echo ""

echo "4. Get user"
curl -s -X POST http://localhost:3000/rpc/users.get \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$USER_ID\"}"
echo ""
echo ""

echo "5. List users"
curl -s -X POST http://localhost:3000/rpc/users.list \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
echo ""
echo ""

echo "6. Math operations"
curl -s -X POST http://localhost:3000/rpc/math.add \
  -H "Content-Type: application/json" \
  -d '{"a": 5, "b": 3}'
echo ""
echo ""

# Kill server
echo "🛑 Stopping HTTP server..."
kill $SERVER_PID
echo ""

echo "✅ All tests passed!"
