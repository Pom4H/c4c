/**
 * Order Processing Workflow Example
 * 
 * Demonstrates:
 * - when() for await nodes (human-in-the-loop)
 * - condition() with switch-case
 * - Multiple pause points
 * - Cross-service integration
 */

import { workflow, step, when, condition } from '@c4c/workflow';
import { z } from 'zod';

// ========================================
// SCHEMAS
// ========================================

const OrderSchema = z.object({
  id: z.string(),
  items: z.array(z.object({
    sku: z.string(),
    quantity: z.number(),
    price: z.number(),
  })),
  customer: z.string(),
  total: z.number(),
  status: z.enum(['pending', 'approved', 'processing', 'shipped', 'delivered', 'cancelled']),
  shippingAddress: z.object({
    street: z.string(),
    city: z.string(),
    country: z.string(),
  }),
});

const RiskScoreSchema = z.object({
  score: z.number(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  factors: z.array(z.string()),
});

const ApprovalSchema = z.object({
  approved: z.boolean(),
  approvedBy: z.string(),
  comment: z.string().optional(),
  timestamp: z.string(),
});

const PaymentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  status: z.enum(['pending', 'completed', 'failed']),
  amount: z.number(),
});

const InventoryReservationSchema = z.object({
  reservationId: z.string(),
  items: z.array(z.object({
    sku: z.string(),
    quantity: z.number(),
    warehouseLocation: z.string(),
  })),
});

const ShipmentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  trackingNumber: z.string(),
  carrier: z.string(),
  estimatedDelivery: z.string(),
});

const DeliveryStatusSchema = z.object({
  orderId: z.string(),
  status: z.enum(['pending', 'in_transit', 'delivered', 'failed']),
  location: z.string().optional(),
  timestamp: z.string(),
});

// ========================================
// WORKFLOW STEPS
// ========================================

// Step 1: Entry point - order created
const onOrderCreated = when({
  id: 'on-order-created',
  on: 'orders.create',
  mode: 'after',
  output: OrderSchema,
});

// Step 2: Calculate risk score
const calculateRisk = step({
  id: 'calculate-risk',
  input: OrderSchema,
  output: RiskScoreSchema,
  execute: ({ engine, inputData }) =>
    engine.run('orders.calculate-risk', {
      orderId: inputData.id,
      customerEmail: inputData.customer,
      total: inputData.total,
      shippingCountry: inputData.shippingAddress.country,
    }),
});

// Step 3: Reject critical risk orders immediately
const rejectOrder = step({
  id: 'reject-order',
  input: OrderSchema,
  output: z.object({ success: z.boolean() }),
  execute: ({ engine, inputData }) =>
    engine.run('orders.update-status', {
      orderId: inputData.id,
      status: 'cancelled',
      reason: 'High risk - automatic rejection',
    }),
});

// Step 4: Wait for manual approval (human-in-the-loop)
const waitForApproval = when({
  id: 'wait-approval',
  on: 'orders.trigger.approved',
  filter: (event, context) => {
    // Only resume this workflow if the approval is for our order
    return (event as any).orderId === context.variables.orderId;
  },
  timeout: {
    duration: 24 * 60 * 60 * 1000, // 24 hours
    onTimeout: 'timeout-cancel',
  },
  output: ApprovalSchema,
});

// Step 5: Check if approved
const checkApprovalResult = condition({
  id: 'check-approval-result',
  input: ApprovalSchema,
  whenTrue: reserveInventory,
  whenFalse: rejectOrder,
  predicate: ({ inputData }) => inputData.approved === true,
});

// Step 6: Reserve inventory
const reserveInventory = step({
  id: 'reserve-inventory',
  input: OrderSchema,
  output: InventoryReservationSchema,
  execute: ({ engine, inputData }) =>
    engine.run('warehouse.inventory.reserve', {
      orderId: inputData.id,
      items: inputData.items,
    }),
});

// Step 7: Create payment session
const createPayment = step({
  id: 'create-payment',
  input: OrderSchema,
  output: z.object({ sessionId: z.string(), paymentUrl: z.string() }),
  execute: ({ engine, inputData }) =>
    engine.run('payment-service.payments.create-session', {
      orderId: inputData.id,
      amount: inputData.total,
      currency: 'USD',
    }),
});

// Step 8: Wait for payment confirmation
const waitForPayment = when({
  id: 'wait-payment',
  on: 'payment-service.payments.trigger.completed',
  filter: (event, context) => {
    return (event as any).orderId === context.variables.orderId;
  },
  timeout: {
    duration: 72 * 60 * 60 * 1000, // 72 hours
    onTimeout: 'timeout-cancel',
  },
  output: PaymentSchema,
});

// Step 9: Create shipment
const createShipment = step({
  id: 'create-shipment',
  input: OrderSchema,
  output: ShipmentSchema,
  execute: ({ engine, inputData }) =>
    engine.run('delivery-service.delivery.create-shipment', {
      orderId: inputData.id,
      address: inputData.shippingAddress,
      items: inputData.items,
    }),
});

// Step 10: Wait for delivery confirmation
const waitForDelivery = when({
  id: 'wait-delivery',
  on: 'delivery-service.delivery.trigger.status-updated',
  filter: (event, context) => {
    const deliveryEvent = event as any;
    return deliveryEvent.orderId === context.variables.orderId && 
           deliveryEvent.status === 'delivered';
  },
  timeout: {
    duration: 30 * 24 * 60 * 60 * 1000, // 30 days
    onTimeout: 'timeout-investigate',
  },
  output: DeliveryStatusSchema,
});

// Step 11: Complete order
const completeOrder = step({
  id: 'complete-order',
  input: OrderSchema,
  output: z.object({ success: z.boolean(), completedAt: z.string() }),
  execute: ({ engine, inputData }) =>
    engine.run('orders.update-status', {
      orderId: inputData.id,
      status: 'delivered',
      completedAt: new Date().toISOString(),
    }),
});

// ========================================
// RISK ROUTING WITH SWITCH-CASE
// ========================================

// Route order based on risk level
const routeByRisk = condition({
  id: 'route-by-risk',
  input: RiskScoreSchema,
  switch: ({ inputData }) => inputData.riskLevel,
  cases: {
    'low': reserveInventory,      // Process immediately
    'medium': reserveInventory,    // Process immediately
    'high': waitForApproval,       // Require manual approval
    'critical': rejectOrder,       // Reject immediately
  },
  default: waitForApproval,        // Default to requiring approval
});

// ========================================
// MAIN WORKFLOW
// ========================================

export const processOrderWorkflow = workflow('process-order')
  .name('Order Processing with Human Approval')
  .description('E-commerce order processing with risk assessment, human approval, and multi-step fulfillment')
  .version('1.0.0')
  // 1. Triggered when order is created
  .step(onOrderCreated)
  // 2. Calculate risk score
  .step(calculateRisk)
  // 3. Route based on risk level (switch-case)
  .step(routeByRisk)
  // 4. Reserve inventory (after approval if needed)
  .step(reserveInventory)
  // 5. Create payment session
  .step(createPayment)
  // 6. Wait for payment (pause point)
  .step(waitForPayment)
  // 7. Create shipment
  .step(createShipment)
  // 8. Wait for delivery (pause point)
  .step(waitForDelivery)
  // 9. Complete order
  .step(completeOrder)
  .commit();

// ========================================
// USAGE EXAMPLE
// ========================================

/**
 * How this workflow runs:
 * 
 * 1. User creates order via API
 *    POST /api/orders { items, customer, total }
 * 
 * 2. orders.create procedure fires -> workflow starts
 * 
 * 3. Risk is calculated:
 *    - Low/Medium: continues immediately
 *    - High: PAUSES at wait-approval step
 *    - Critical: rejects and ends
 * 
 * 4. For high-risk orders, manager sees in dashboard:
 *    GET /api/workflows/paused
 *    Returns: [{ executionId, orderId, pausedAt: "wait-approval", ... }]
 * 
 * 5. Manager approves:
 *    POST /api/orders/approve { orderId, approved: true, comment: "..." }
 *    -> orders.trigger.approved fires -> workflow RESUMES
 * 
 * 6. Inventory is reserved, payment session created
 * 
 * 7. Workflow PAUSES at wait-payment step
 *    Customer pays via Stripe/other gateway
 *    Webhook arrives -> workflow RESUMES
 * 
 * 8. Shipment is created, workflow PAUSES at wait-delivery
 * 
 * 9. Courier delivers, sends webhook -> workflow RESUMES
 * 
 * 10. Order is marked as complete!
 * 
 * The workflow can pause at multiple points and resume when
 * external events arrive. Each pause is persisted so it survives
 * restarts.
 */
