# 🛒 Order Processing System

Real-world e-commerce order processing with **human-in-the-loop** approval, multiple triggers, and cross-service integration.

## Features

- ✅ **Risk Assessment** - Automatic fraud detection
- 👤 **Human Approval** - Manual review for high-risk orders
- ⏸️ **Workflow Pause/Resume** - Wait for external events (payment, delivery)
- 🔄 **Multiple Triggers** - Internal procedures + external webhooks
- 🎯 **Switch-Case Logic** - Order status routing
- 🏪 **Cross-Service Integration** - 4 microservices working together

## Architecture

```
┌─────────────────────────────────────────────────┐
│   Order Service                                 │
│   - Create orders                               │
│   - Risk assessment                             │
│   - Manual approval                             │
│   Port: 3001                                    │
└─────────────────────────────────────────────────┘
         ↓ triggers workflow
┌─────────────────────────────────────────────────┐
│   Order Processing Workflow                     │
│   1. Calculate risk score                       │
│   2. IF high risk → AWAIT manual approval       │
│   3. Reserve inventory (→ Warehouse)            │
│   4. Create payment (→ Payment)                 │
│   5. AWAIT payment confirmation                 │
│   6. Create shipment (→ Delivery)               │
│   7. AWAIT delivery confirmation                │
│   8. Complete order                             │
└─────────────────────────────────────────────────┘
         ↓ calls
┌──────────────┬──────────────┬──────────────────┐
│  Payment     │  Warehouse   │  Delivery        │
│  Port: 3002  │  Port: 3003  │  Port: 3004      │
└──────────────┴──────────────┴──────────────────┘
```

## Workflow Flow

```typescript
// 1. Order created (internal trigger)
when({ on: 'orders.create', mode: 'after' })

// 2. Calculate risk
step({ procedure: 'orders.calculate-risk' })

// 3. Conditional approval
condition({
  switch: (ctx) => ctx.inputData.riskLevel,
  cases: {
    'low': reserveInventory,
    'medium': reserveInventory,
    'high': waitForApproval  // ← PAUSE HERE
  }
})

// 4. Wait for manual approval (human-in-the-loop)
when({ on: 'orders.trigger.approved', filter: ... })

// 5. Reserve inventory
step({ procedure: 'warehouse.inventory.reserve' })

// 6. Wait for payment (external webhook)
when({ on: 'payment-service.payments.trigger.completed' })

// 7. Create shipment
step({ procedure: 'delivery-service.delivery.create-shipment' })

// 8. Wait for delivery (external webhook)
when({ on: 'delivery-service.delivery.trigger.status-updated' })

// 9. Complete
step({ procedure: 'orders.update-status' })
```

## Running

```bash
# Install dependencies
pnpm install

# Start all services (4 terminals)
pnpm --filter order-service dev        # Port 3001
pnpm --filter payment-service dev      # Port 3002  
pnpm --filter warehouse-service dev    # Port 3003
pnpm --filter delivery-service dev     # Port 3004

# Or use concurrently
pnpm dev:all
```

## Testing

### Scenario 1: Normal Order (Low Risk)

```bash
# Create order
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"sku": "LAPTOP", "quantity": 1}],
    "customer": "john@example.com",
    "total": 999
  }'

# Workflow starts automatically and pauses at payment step
# Simulate payment webhook
curl -X POST http://localhost:3001/webhooks/payment \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_123",
    "status": "completed",
    "amount": 999
  }'

# Workflow resumes, pauses at delivery
# Simulate delivery webhook
curl -X POST http://localhost:3001/webhooks/delivery \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_123",
    "status": "delivered"
  }'

# Workflow completes!
```

### Scenario 2: High-Risk Order (Human Approval)

```bash
# Create suspicious order
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"sku": "LAPTOP", "quantity": 50}],
    "customer": "newuser@example.com",
    "total": 49950,
    "shippingCountry": "XX"
  }'

# Workflow pauses at approval step
# Check paused workflows
curl http://localhost:3001/api/workflows/paused

# Manager approves
curl -X POST http://localhost:3001/api/orders/approve \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_124",
    "approved": true,
    "comment": "Verified with customer"
  }'

# Workflow resumes and continues...
```

## Key Concepts Demonstrated

### 1. when() - Await External Events
```typescript
const waitForPayment = when({
  id: 'wait-payment',
  on: 'payment-service.payments.trigger.completed',
  filter: (event, ctx) => event.orderId === ctx.variables.orderId,
  timeout: {
    duration: 24 * 60 * 60 * 1000, // 24 hours
    onTimeout: 'cancel-order'
  },
  output: PaymentSchema
});
```

### 2. condition() with Switch-Case
```typescript
condition({
  id: 'route-by-risk',
  input: RiskScoreSchema,
  switch: (ctx) => ctx.inputData.riskLevel,
  cases: {
    'low': processNormally,
    'medium': processNormally,
    'high': requireApproval,
    'critical': rejectOrder
  },
  default: requireApproval
})
```

### 3. Human-in-the-Loop
```typescript
// Workflow pauses here
const waitForApproval = when({
  id: 'wait-approval',
  on: 'orders.trigger.approved',
  filter: (event, ctx) => event.orderId === ctx.variables.orderId,
  output: ApprovalSchema
});

// Manager dashboard shows pending approvals
// POST /api/orders/approve triggers resume
```

### 4. Multiple Pause Points
```typescript
workflow('process-order')
  .step(when({ on: 'orders.create' }))      // Start
  .step(calculateRisk)
  .step(checkApproval)
  .step(when({ on: 'orders.approved' }))    // Pause 1
  .step(reserveInventory)
  .step(when({ on: 'payment.completed' }))  // Pause 2
  .step(createShipment)
  .step(when({ on: 'delivery.delivered' })) // Pause 3
  .step(completeOrder)
  .commit();
```

## File Structure

```
order-processing/
├── package.json
├── README.md
├── order-service/
│   ├── procedures/
│   │   ├── orders.ts           # CRUD + risk assessment
│   │   └── triggers.ts         # order.created, order.approved
│   └── workflows/
│       └── process-order.ts    # Main workflow
├── payment-service/
│   ├── procedures/
│   │   └── payments.ts         # Payment processing
│   └── triggers.ts             # payment.completed webhook
├── warehouse-service/
│   ├── procedures/
│   │   └── inventory.ts        # Inventory management
│   └── triggers.ts             # (optional)
└── delivery-service/
    ├── procedures/
    │   └── delivery.ts         # Shipment creation
    └── triggers.ts             # delivery.status-updated webhook
```

## Next Steps

- [ ] Add error handling workflows
- [ ] Implement timeout handlers
- [ ] Add order cancellation flow
- [ ] Create manager dashboard UI
- [ ] Add metrics and monitoring
- [ ] Implement retry logic

## Benefits

✅ **Type-safe** - Full TypeScript typing across all services  
✅ **Observable** - OpenTelemetry tracing for entire flow  
✅ **Resilient** - Pause/resume survives restarts (with persistent storage)  
✅ **Flexible** - Easy to add new steps or services  
✅ **Testable** - Mock webhooks for testing  
✅ **Auditable** - Complete history of workflow executions
