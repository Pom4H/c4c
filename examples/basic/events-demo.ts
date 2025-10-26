/**
 * Event-Driven Workflows Demo
 * 
 * Shows how to emit internal events and trigger workflows
 */

import { createRegistry } from '@c4c/core';
import { 
	createTriggerWorkflowManager,
	emitWorkflowEvent,
	getWorkflowEventEmitter,
} from '@c4c/workflow';
import { eventDrivenWorkflows } from './workflows/events-example.js';

// ==========================================
// Setup
// ==========================================

const registry = createRegistry();

// Register mock procedures for demo
registry.register({
	contract: {
		name: 'email.send',
		input: {} as any,
		output: {} as any,
	},
	handler: async (input) => {
		console.log('📧 [Email] Sending email:', input);
		return { emailSent: true, messageId: `msg_${Date.now()}` };
	},
});

registry.register({
	contract: {
		name: 'payment.process',
		input: {} as any,
		output: {} as any,
	},
	handler: async (input) => {
		console.log('💳 [Payment] Processing payment:', input);
		return { success: true, transactionId: `txn_${Date.now()}` };
	},
});

registry.register({
	contract: {
		name: 'inventory.update',
		input: {} as any,
		output: {} as any,
	},
	handler: async (input) => {
		console.log('📦 [Inventory] Updating inventory:', input);
		return { updated: true };
	},
});

registry.register({
	contract: {
		name: 'notification.send',
		input: {} as any,
		output: {} as any,
	},
	handler: async (input) => {
		console.log('🔔 [Notification] Sending notification:', input);
		return { sent: true };
	},
});

registry.register({
	contract: {
		name: 'data.validate',
		input: {} as any,
		output: {} as any,
	},
	handler: async (input) => {
		console.log('✅ [Validator] Validating data:', input);
		return { valid: true, errors: [] };
	},
});

registry.register({
	contract: {
		name: 'data.transform',
		input: {} as any,
		output: {} as any,
	},
	handler: async (input) => {
		console.log('🔄 [Transform] Transforming data:', input);
		return { transformedFileId: `file_transformed_${Date.now()}`, rowCount: 1000 };
	},
});

registry.register({
	contract: {
		name: 'database.load',
		input: {} as any,
		output: {} as any,
	},
	handler: async (input) => {
		console.log('💾 [Database] Loading data:', input);
		return { loaded: true, recordsInserted: 1000 };
	},
});

registry.register({
	contract: {
		name: 'audit.log',
		input: {} as any,
		output: {} as any,
	},
	handler: async (input) => {
		console.log('📝 [Audit] Logging event:', input);
		return { logged: true, logId: `log_${Date.now()}` };
	},
});

// ==========================================
// Deploy Workflows
// ==========================================

async function main() {
	console.log('🚀 Starting Event-Driven Workflows Demo\n');

	// Create trigger manager (no webhook registry needed for internal events)
	const triggerManager = createTriggerWorkflowManager(registry);

	// Get event emitter to see registered events
	const eventEmitter = getWorkflowEventEmitter();

	// For internal event workflows, we need to manually register them
	// (since they don't have external trigger procedures to deploy)
	console.log('📦 Registering event-driven workflows...\n');

	// Register internal event handlers by simulating deployment
	// For internal events, we don't need full deployment
	for (const workflow of eventDrivenWorkflows) {
		// Find trigger nodes and register handlers
		for (const node of workflow.nodes) {
			if (node.type === 'trigger' && node.config) {
				const config = node.config as Record<string, unknown>;
				const isInternal = config.internal === true;
				const eventName = config.eventName as string | undefined;

				if (isInternal && eventName) {
					console.log(`  ✓ Registered: ${eventName} → ${workflow.name}`);
					
					eventEmitter.on(eventName, async (payload) => {
						console.log(`\n🎯 [Event] ${eventName} triggered!`);
						console.log(`   Payload:`, payload);
						console.log(`   Executing workflow: ${workflow.name}\n`);

						// Import and execute the workflow
						const { executeWorkflow } = await import('@c4c/workflow');
						
						try {
							const result = await executeWorkflow(workflow, registry, {
								trigger: {
									event: eventName,
									payload,
									timestamp: new Date(),
									provider: 'internal',
								},
								...payload,
							});

							console.log(`\n✅ Workflow completed: ${workflow.name}`);
							console.log(`   Execution ID: ${result.executionId}`);
							console.log(`   Duration: ${result.executionTime}ms`);
							console.log(`   Nodes executed: ${result.nodesExecuted.length}\n`);
						} catch (error) {
							console.error(`\n❌ Workflow failed: ${workflow.name}`, error);
						}
					});
				}
			}
		}
	}

	console.log('\n✨ All workflows registered!\n');
	console.log('━'.repeat(60));
	console.log('\n📤 Emitting test events...\n');

	// ==========================================
	// Test 1: User Created Event
	// ==========================================

	console.log('1️⃣ Testing user.created event...');
	await emitWorkflowEvent('user.created', {
		userId: 'user_123',
		email: 'john@example.com',
		name: 'John Doe',
	});

	await sleep(1000);

	// ==========================================
	// Test 2: Order Placed Event
	// ==========================================

	console.log('2️⃣ Testing order.placed event...');
	await emitWorkflowEvent('order.placed', {
		orderId: 'order_456',
		amount: 99.99,
		currency: 'USD',
		userId: 'user_123',
		items: [
			{ productId: 'prod_1', quantity: 2 },
			{ productId: 'prod_2', quantity: 1 },
		],
	});

	await sleep(1000);

	// ==========================================
	// Test 3: Data Uploaded Event
	// ==========================================

	console.log('3️⃣ Testing data.uploaded event...');
	await emitWorkflowEvent('data.uploaded', {
		fileId: 'file_789',
		filename: 'customers.csv',
		size: 1024000,
		userId: 'user_123',
	});

	await sleep(1000);

	// ==========================================
	// Test 4: Audit Event (Wildcard)
	// ==========================================

	console.log('4️⃣ Testing audit.user.login event (wildcard)...');
	await emitWorkflowEvent('audit.user.login', {
		eventType: 'audit.user.login',
		userId: 'user_123',
		timestamp: new Date(),
		data: {
			ip: '192.168.1.1',
			userAgent: 'Mozilla/5.0',
		},
	});

	await sleep(1000);

	console.log('━'.repeat(60));
	console.log('\n✅ Demo completed!\n');
	console.log('Event listener counts:');
	console.log(`  user.created: ${eventEmitter.listenerCount('user.created')}`);
	console.log(`  order.placed: ${eventEmitter.listenerCount('order.placed')}`);
	console.log(`  data.uploaded: ${eventEmitter.listenerCount('data.uploaded')}`);
	console.log(`  audit.*: ${eventEmitter.listenerCount('audit.user.login')}`);
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Run demo
main().catch(console.error);
