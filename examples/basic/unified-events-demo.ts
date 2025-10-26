/**
 * Unified Event System Demo
 * 
 * Shows how internal and external events work the same way through trigger procedures.
 * When moving from monolith to microservices, workflows don't change!
 */

import { createRegistry } from '@c4c/core';
import { 
	workflow,
	step,
	createTriggerProcedure,
	emitTriggerEvent,
	createTriggerWorkflowManager,
} from '@c4c/workflow';
import { z } from 'zod';

// ==========================================
// 1. DEFINE TRIGGER PROCEDURES
// ==========================================

// Trigger procedure for user.created event
// Works for BOTH internal calls and external webhooks
const userCreatedTrigger = createTriggerProcedure(
	'user.trigger.created',
	z.object({
		userId: z.string(),
		email: z.string(),
		name: z.string(),
	}),
	{
		description: 'Triggered when a new user is created',
		provider: 'users',
		eventTypes: ['created'],
		exposure: 'internal', // Can be 'external' for webhooks
	}
);

// Trigger procedure for order.placed event
const orderPlacedTrigger = createTriggerProcedure(
	'order.trigger.placed',
	z.object({
		orderId: z.string(),
		userId: z.string(),
		amount: z.number(),
		items: z.array(z.object({
			productId: z.string(),
			quantity: z.number(),
		})),
	}),
	{
		description: 'Triggered when an order is placed',
		provider: 'orders',
		eventTypes: ['placed'],
		exposure: 'internal',
	}
);

// ==========================================
// 2. DEFINE WORKFLOWS USING TRIGGERS
// ==========================================

// Workflow triggered by user.created
const userOnboardingWorkflow = workflow('user-onboarding')
	.name('User Onboarding')
	.description('Send welcome email when user is created')
	.on('user.trigger.created', step({
		id: 'send-welcome-email',
		procedure: 'email.send',
		input: z.object({
			userId: z.string(),
			email: z.string(),
			name: z.string(),
		}),
		output: z.object({
			sent: z.boolean(),
			messageId: z.string().optional(),
		}),
		config: {
			template: 'welcome',
		},
	}))
	.step(step({
		id: 'track-signup',
		procedure: 'analytics.track',
		input: z.object({
			userId: z.string(),
			event: z.string(),
		}),
		output: z.object({
			tracked: z.boolean(),
		}),
		config: {
			event: 'user_signed_up',
		},
	}))
	.commit();

// Workflow triggered by order.placed
const orderProcessingWorkflow = workflow('order-processing')
	.name('Order Processing')
	.description('Process order when it is placed')
	.on('order.trigger.placed', step({
		id: 'charge-payment',
		procedure: 'payment.charge',
		input: z.object({
			orderId: z.string(),
			amount: z.number(),
		}),
		output: z.object({
			success: z.boolean(),
			transactionId: z.string().optional(),
		}),
	}))
	.step(step({
		id: 'reserve-inventory',
		procedure: 'inventory.reserve',
		input: z.object({
			orderId: z.string(),
			items: z.array(z.any()),
		}),
		output: z.object({
			reserved: z.boolean(),
		}),
	}))
	.step(step({
		id: 'send-confirmation',
		procedure: 'notification.send',
		input: z.object({
			userId: z.string(),
			message: z.string(),
		}),
		output: z.object({
			sent: z.boolean(),
		}),
		config: {
			message: 'Your order has been confirmed!',
		},
	}))
	.commit();

// ==========================================
// 3. SETUP REGISTRY WITH PROCEDURES
// ==========================================

const registry = createRegistry();

// Register trigger procedures
registry.register(userCreatedTrigger);
registry.register(orderPlacedTrigger);

// Register mock handler procedures
registry.register({
	contract: {
		name: 'email.send',
		input: z.any(),
		output: z.any(),
	},
	handler: async (input) => {
		console.log('📧 [Email] Sending email:', input);
		return { sent: true, messageId: `msg_${Date.now()}` };
	},
});

registry.register({
	contract: {
		name: 'analytics.track',
		input: z.any(),
		output: z.any(),
	},
	handler: async (input) => {
		console.log('📊 [Analytics] Tracking event:', input);
		return { tracked: true };
	},
});

registry.register({
	contract: {
		name: 'payment.charge',
		input: z.any(),
		output: z.any(),
	},
	handler: async (input) => {
		console.log('💳 [Payment] Charging payment:', input);
		return { success: true, transactionId: `txn_${Date.now()}` };
	},
});

registry.register({
	contract: {
		name: 'inventory.reserve',
		input: z.any(),
		output: z.any(),
	},
	handler: async (input) => {
		console.log('📦 [Inventory] Reserving items:', input);
		return { reserved: true };
	},
});

registry.register({
	contract: {
		name: 'notification.send',
		input: z.any(),
		output: z.any(),
	},
	handler: async (input) => {
		console.log('🔔 [Notification] Sending notification:', input);
		return { sent: true };
	},
});

// ==========================================
// 4. REGISTER WORKFLOWS WITH TRIGGER MANAGER
// ==========================================

async function main() {
	console.log('🚀 Starting Unified Event System Demo\n');
	console.log('━'.repeat(60));
	
	const triggerManager = createTriggerWorkflowManager(registry);
	
	// For internal events, we don't need to deploy with webhookUrl
	// We just register the workflow with the trigger manager
	// (In real app with external webhooks, you would call deploy() with webhookUrl)
	
	console.log('\n📦 Registering workflows...\n');
	
	// Register workflows by importing registerTriggerHandler
	const { registerTriggerHandler } = await import('@c4c/workflow');
	
	registerTriggerHandler(
		'user.trigger.created',
		userOnboardingWorkflow,
		registry
	);
	console.log('  ✓ Registered: user-onboarding workflow');
	
	registerTriggerHandler(
		'order.trigger.placed',
		orderProcessingWorkflow,
		registry
	);
	console.log('  ✓ Registered: order-processing workflow');
	
	console.log('\n✨ All workflows registered!');
	console.log('━'.repeat(60));
	
	// ==========================================
	// 5. EMIT EVENTS (MONOLITH MODE)
	// ==========================================
	
	console.log('\n📤 [MONOLITH MODE] Emitting internal events...\n');
	
	// In monolith: emit events from within your application
	console.log('1️⃣ Creating user...');
	await emitTriggerEvent(
		'user.trigger.created',
		{
			userId: 'user_123',
			email: 'john@example.com',
			name: 'John Doe',
		},
		registry
	);
	
	await sleep(500);
	
	console.log('\n2️⃣ Placing order...');
	await emitTriggerEvent(
		'order.trigger.placed',
		{
			orderId: 'order_456',
			userId: 'user_123',
			amount: 99.99,
			items: [
				{ productId: 'prod_1', quantity: 2 },
				{ productId: 'prod_2', quantity: 1 },
			],
		},
		registry
	);
	
	await sleep(500);
	
	console.log('\n━'.repeat(60));
	console.log('\n✅ Demo completed!');
	
	// ==========================================
	// 6. WHAT CHANGES IN MICROSERVICES?
	// ==========================================
	
	console.log('\n📚 What changes when moving to microservices?\n');
	console.log('WORKFLOWS: Nothing! They stay exactly the same.');
	console.log('TRIGGER PROCEDURES: Change exposure to "external"');
	console.log('EVENT EMISSION:');
	console.log('  Before (monolith):');
	console.log('    emitTriggerEvent("user.trigger.created", data, registry)');
	console.log('  After (microservices):');
	console.log('    POST /webhooks/users → calls user.trigger.created');
	console.log('\nThe workflow definition is 100% portable! 🎉');
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Run demo
main().catch(console.error);
