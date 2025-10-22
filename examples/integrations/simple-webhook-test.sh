#!/bin/bash

echo "🧪 Testing Webhook Integration"
echo ""

# Start server in background
echo "🚀 Starting server..."
cd /workspace/examples/integrations
node --import tsx -e "
import { collectRegistry } from '@c4c/core';
import { createHttpServer, WebhookRegistry } from '@c4c/adapters';
import { EventRouter } from '@c4c/workflow';

const registry = await collectRegistry('./procedures');
const webhookRegistry = new WebhookRegistry();
const eventRouter = new EventRouter();

webhookRegistry.registerHandler('googleDrive', async (event) => {
  console.log('\\n📨 Webhook received:', {
    id: event.id,
    provider: event.provider,
    eventType: event.eventType
  });
  console.log('📦 Payload:', JSON.stringify(event.payload, null, 2));
});

createHttpServer(registry, 3000, {
  enableWebhooks: true,
  webhookRegistry,
});

console.log('\\n✅ Server ready! Waiting for webhooks...\\n');
" &

SERVER_PID=$!

# Wait for server to start
sleep 3

echo ""
echo "🧪 Sending test webhook..."
echo ""

# Send webhook request
curl -X POST http://localhost:3000/webhooks/googleDrive \
  -H "Content-Type: application/json" \
  -H "X-Goog-Channel-ID: test-channel-123" \
  -H "X-Goog-Resource-State: change" \
  -d '{
    "kind": "drive#change",
    "changeType": "file",
    "fileId": "test-file-456",
    "file": {
      "id": "test-file-456",
      "name": "test-document.pdf",
      "mimeType": "application/pdf",
      "modifiedTime": "2024-01-01T12:00:00Z"
    }
  }' \
  -w "\n\nHTTP Status: %{http_code}\n\n" \
  -s

echo ""
echo "✅ Webhook sent! Check server logs above."
echo ""

# Wait to see logs
sleep 2

# Kill server
kill $SERVER_PID 2>/dev/null

echo "🎉 Test complete!"
