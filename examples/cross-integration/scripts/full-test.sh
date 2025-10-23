#!/bin/bash

# Complete integration test: start → integrate → test → stop

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        C4C Cross-Integration - Full Integration Test          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Cleanup function
cleanup() {
  echo ""
  echo "🧹 Cleaning up..."
  "$SCRIPT_DIR/stop-apps.sh"
}

# Register cleanup on exit
trap cleanup EXIT

# 1. Start apps
echo "═══════════════════════════════════════════════════════════════"
echo "STEP 1: Starting applications"
echo "═══════════════════════════════════════════════════════════════"
"$SCRIPT_DIR/start-apps.sh"

# Give servers a moment to settle
sleep 2

# 2. Verify apps are running
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "STEP 2: Verifying applications"
echo "═══════════════════════════════════════════════════════════════"

echo "Checking App A OpenAPI..."
if curl -sf http://localhost:3001/openapi.json > /dev/null; then
  PROCEDURES_A=$(curl -s http://localhost:3001/openapi.json | jq -r '.paths | keys | length')
  echo "✅ App A is responding ($PROCEDURES_A endpoints)"
else
  echo "❌ App A is not responding"
  exit 1
fi

echo "Checking App B OpenAPI..."
if curl -sf http://localhost:3002/openapi.json > /dev/null; then
  PROCEDURES_B=$(curl -s http://localhost:3002/openapi.json | jq -r '.paths | keys | length')
  echo "✅ App B is responding ($PROCEDURES_B endpoints)"
else
  echo "❌ App B is not responding"
  exit 1
fi

# 3. Integration
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "STEP 3: Cross-integration"
echo "═══════════════════════════════════════════════════════════════"
"$SCRIPT_DIR/integrate-apps.sh"

# 4. Test integration
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "STEP 4: Testing integration"
echo "═══════════════════════════════════════════════════════════════"
"$SCRIPT_DIR/test-integration.sh"

# 5. Summary
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ ALL TESTS PASSED! ✅                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "   App A endpoints: $PROCEDURES_A"
echo "   App B endpoints: $PROCEDURES_B"
echo "   Integration: ✅ Working"
echo "   Cross-app calls: ✅ Working"
echo ""
echo "🎉 C4C Cross-Integration is fully functional!"
