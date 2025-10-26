# 🏪 Business Case: E-commerce Order Processing System

## Overview

Complex multi-service order processing workflow with:
- **Fraud detection** (risk assessment)
- **Human-in-the-loop** (manual approval for risky orders)
- **External integrations** (payment gateway, warehouse, delivery)
- **Multiple triggers** (internal procedures + external webhooks)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Order Service (App A)                       │
│                                                                 │
│  Procedures:                                                    │
│  - orders.create                                                │
│  - orders.calculate-risk                                        │
│  - orders.update-status                                         │
│  - orders.approve (manual approval endpoint)                    │
│                                                                 │
│  Triggers:                                                      │
│  - orders.trigger.created (internal, after orders.create)       │
│  - orders.trigger.approved (webhook, manual approval)           │
│                                                                 │
│  Workflows:                                                     │
│  - process-new-order (triggered by orders.create)               │
│    → Risk check                                                 │
│    → IF high risk: PAUSE and wait for approval                  │
│    → Reserve inventory                                          │
│    → PAUSE and wait for payment webhook                         │
│    → Ship order                                                 │
│    → PAUSE and wait for delivery webhook                        │
│    → Complete order                                             │
│                                                                 │
│  Port: 3001                                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↕
                    c4c integrate (OpenAPI)
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                  Payment Service (App B)                        │
│                                                                 │
│  Procedures:                                                    │
│  - payments.create-session                                      │
│  - payments.process                                             │
│                                                                 │
│  Triggers:                                                      │
│  - payments.trigger.completed (webhook from Stripe)             │
│                                                                 │
│  Port: 3002                                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                  Warehouse Service (App C)                      │
│                                                                 │
│  Procedures:                                                    │
│  - inventory.check-availability                                 │
│  - inventory.reserve                                            │
│  - inventory.release                                            │
│                                                                 │
│  Port: 3003                                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                  Delivery Service (App D)                       │
│                                                                 │
│  Procedures:                                                    │
│  - delivery.create-shipment                                     │
│  - delivery.get-status                                          │
│                                                                 │
│  Triggers:                                                      │
│  - delivery.trigger.status-updated (webhook from courier)       │
│                                                                 │
│  Port: 3004                                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Flow Diagram

```
Customer creates order
         ↓
   [orders.create] ← triggers workflow
         ↓
   Calculate risk score
         ↓
    Risk < 70?
    ├─ YES → Reserve inventory
    └─ NO → [PAUSE] Wait for manager approval
              ↓
         Manager reviews
              ↓
         [orders.approve] ← triggers resume
              ↓
         Resume workflow
              ↓
    Reserve inventory (warehouse service)
         ↓
    Create payment session (payment service)
         ↓
    [PAUSE] Wait for payment webhook
         ↓
    [payments.trigger.completed] ← webhook from Stripe
         ↓
    Create shipment (delivery service)
         ↓
    [PAUSE] Wait for delivery status
         ↓
    [delivery.trigger.status-updated] ← webhook from courier
         ↓
    Complete order
         ↓
    Send confirmation email
```

## Key Features

### 1. Internal Triggers
- Order created → automatically start processing
- Order approved → resume paused workflow

### 2. External Triggers (Webhooks)
- Payment completed (Stripe webhook)
- Delivery status updated (courier webhook)

### 3. Human-in-the-Loop
- High-risk orders pause for manual review
- Manager dashboard shows pending approvals
- Approval/rejection resumes workflow

### 4. Cross-Service Integration
- Payment service (Stripe integration)
- Warehouse service (inventory management)
- Delivery service (shipping provider integration)

### 5. Error Handling
- Payment failure → release inventory, cancel order
- Delivery failure → create support ticket
- Timeout handling → auto-cancel after 24h

## Workflow Code Example

```typescript
// app-a/workflows/process-order.ts
import { workflow, step, when, condition, parallel } from '@c4c/workflow';

// Step 1: Calculate risk
const calculateRisk = step({
  id: 'calculate-risk',
  input: OrderSchema,
  output: RiskScoreSchema,
  execute: ({ engine, inputData }) => 
    engine.run('orders.calculate-risk', { orderId: inputData.id })
});

// Step 2: Check if needs approval
const needsApproval = condition({
  id: 'check-risk',
  input: RiskScoreSchema,
  whenTrue: waitForApproval,
  whenFalse: reserveInventory,
  predicate: ({ inputData }) => inputData.score > 70
});

// Human-in-the-loop: Wait for approval
const waitForApproval = when({
  id: 'wait-approval',
  on: 'orders.trigger.approved',
  filter: { orderId: '{{ order.id }}' },
  output: ApprovalSchema,
});

// Step 3: Reserve inventory
const reserveInventory = step({
  id: 'reserve-inventory',
  input: OrderSchema,
  output: ReservationSchema,
  execute: ({ engine, inputData }) => 
    engine.run('warehouse.inventory.reserve', {
      items: inputData.items,
      orderId: inputData.id
    })
});

// Step 4: Wait for payment
const waitForPayment = when({
  id: 'wait-payment',
  on: 'payment-service.payments.trigger.completed',
  filter: { orderId: '{{ order.id }}' },
  output: PaymentSchema,
});

// Step 5: Create shipment
const createShipment = step({
  id: 'create-shipment',
  input: OrderSchema,
  output: ShipmentSchema,
  execute: ({ engine, inputData }) => 
    engine.run('delivery-service.delivery.create-shipment', {
      orderId: inputData.id,
      address: inputData.shippingAddress
    })
});

// Step 6: Wait for delivery
const waitForDelivery = when({
  id: 'wait-delivery',
  on: 'delivery-service.delivery.trigger.status-updated',
  filter: { 
    orderId: '{{ order.id }}',
    status: 'delivered'
  },
  output: DeliveryStatusSchema,
});

// Step 7: Complete order
const completeOrder = step({
  id: 'complete-order',
  input: OrderSchema,
  output: z.object({ success: z.boolean() }),
  execute: ({ engine, inputData }) => 
    engine.run('orders.update-status', {
      orderId: inputData.id,
      status: 'completed'
    })
});

// Main workflow
export const processOrderWorkflow = workflow('process-order')
  // Entry point: triggered when order is created
  .step(when({
    id: 'on-order-created',
    on: 'orders.create',
    mode: 'after',
    output: OrderSchema,
  }))
  // Risk assessment
  .step(calculateRisk)
  .step(needsApproval)
  // Wait for approval if needed (human-in-the-loop)
  .step(waitForApproval)
  // Reserve inventory
  .step(reserveInventory)
  // Parallel: send confirmation email + create payment session
  .step(parallel({
    id: 'notify-and-pay',
    branches: [
      step({
        id: 'send-email',
        execute: ({ engine }) => 
          engine.run('notifications.send', { type: 'order-confirmed' })
      }),
      step({
        id: 'create-payment',
        execute: ({ engine, inputData }) => 
          engine.run('payment-service.payments.create-session', {
            orderId: inputData.id,
            amount: inputData.total
          })
      })
    ]
  }))
  // Wait for payment webhook
  .step(waitForPayment)
  // Create shipment
  .step(createShipment)
  // Wait for delivery webhook
  .step(waitForDelivery)
  // Complete order
  .step(completeOrder)
  .commit();
```

## Benefits

1. **Real-world complexity**: Multiple services, multiple triggers
2. **Human oversight**: Manual approval for risky orders
3. **Event-driven**: Pauses and resumes based on external events
4. **Type-safe**: Full TypeScript typing across all services
5. **Observable**: OpenTelemetry tracing for entire flow
6. **Resilient**: Error handling and timeout management

## Testing Scenarios

### Scenario 1: Normal Order (Low Risk)
```bash
# Create order
curl -X POST http://localhost:3001/api/orders \
  -d '{"items": [...], "total": 100}'

# Workflow starts automatically
# → Calculates risk (score: 30)
# → Reserves inventory
# → Waits for payment

# Simulate payment webhook
curl -X POST http://localhost:3001/webhooks/payment \
  -d '{"orderId": "...", "status": "completed"}'

# → Creates shipment
# → Waits for delivery

# Simulate delivery webhook
curl -X POST http://localhost:3001/webhooks/delivery \
  -d '{"orderId": "...", "status": "delivered"}'

# → Order completed
```

### Scenario 2: High-Risk Order (Human Approval)
```bash
# Create suspicious order
curl -X POST http://localhost:3001/api/orders \
  -d '{"items": [...], "total": 50000, "newCustomer": true}'

# Workflow pauses at approval step
# Manager sees order in dashboard

# Manager approves
curl -X POST http://localhost:3001/api/orders/approve \
  -d '{"orderId": "...", "approved": true}'

# Workflow resumes from approval step
# → Continues with inventory reservation...
```

### Scenario 3: Payment Failure
```bash
# Payment webhook with failure
curl -X POST http://localhost:3001/webhooks/payment \
  -d '{"orderId": "...", "status": "failed"}'

# → Workflow goes to error handler
# → Releases inventory
# → Sends cancellation email
# → Updates order status to "cancelled"
```

## Implementation Plan

1. Create base procedures in each service
2. Implement `when()` helper in workflow builder
3. Add pause/resume mechanism in workflow runtime
4. Create TriggerWorkflowManager with pause support
5. Build manager dashboard for approvals
6. Add webhook handlers for external systems
7. Implement timeout and error handling
8. Add OpenTelemetry tracing
9. Create integration tests

## Next Steps

See implementation in:
- `/examples/cross-integration/order-processing/`
