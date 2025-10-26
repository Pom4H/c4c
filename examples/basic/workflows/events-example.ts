/**
 * Event-Driven Workflows Example
 * 
 * Demonstrates using workflow.on() for both internal and external events
 */

import { z } from 'zod';
import { workflow, step } from '@c4c/workflow';

// ==========================================
// EXAMPLE 1: Internal Events
// ==========================================

/**
 * User Created Workflow
 * Triggered by internal "user.created" event
 */
export const userCreatedWorkflow = workflow('user-created-handler')
	.name('User Created Handler')
	.description('Handles user.created events')
	.on(
		'user.created',
		step({
			id: 'send-welcome-email',
			procedure: 'email.send',
			input: z.object({
				userId: z.string(),
				email: z.string(),
				name: z.string(),
			}),
			output: z.object({
				emailSent: z.boolean(),
				messageId: z.string().optional(),
			}),
			config: {
				template: 'welcome',
				subject: 'Welcome to our platform!',
			},
		}),
		{ internal: true } // Internal event
	)
	.commit();

/**
 * Order Placed Workflow
 * Triggered by internal "order.placed" event
 */
export const orderPlacedWorkflow = workflow('order-placed-handler')
	.name('Order Placed Handler')
	.description('Handles order.placed events')
	.on(
		'order.placed',
		step({
			id: 'process-payment',
			procedure: 'payment.process',
			input: z.object({
				orderId: z.string(),
				amount: z.number(),
				currency: z.string(),
			}),
			output: z.object({
				success: z.boolean(),
				transactionId: z.string().optional(),
			}),
		}),
		{ internal: true }
	)
	.step(
		step({
			id: 'update-inventory',
			procedure: 'inventory.update',
			input: z.object({
				orderId: z.string(),
				items: z.array(z.object({
					productId: z.string(),
					quantity: z.number(),
				})),
			}),
			output: z.object({
				updated: z.boolean(),
			}),
		})
	)
	.step(
		step({
			id: 'notify-customer',
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
		})
	)
	.commit();

// ==========================================
// EXAMPLE 2: External Events (Telegram)
// ==========================================

/**
 * Telegram Message Workflow
 * Triggered by external Telegram webhook
 */
export const telegramMessageWorkflow = workflow('telegram-message-handler')
	.name('Telegram Message Handler')
	.description('Handles incoming Telegram messages')
	.on(
		'telegram.message',
		step({
			id: 'route-message',
			procedure: 'telegram.route.event',
			input: z.object({
				update: z.any(),
			}),
			output: z.object({
				eventType: z.string(),
				shouldProcess: z.boolean(),
			}),
		}),
		{ 
			provider: 'telegram',
			eventType: 'message',
			internal: false, // External webhook
		}
	)
	.step(
		step({
			id: 'handle-message',
			procedure: 'telegram.handle.message',
			input: z.object({
				update: z.any(),
			}),
			output: z.object({
				reply: z.string(),
				shouldReply: z.boolean(),
			}),
		})
	)
	.step(
		step({
			id: 'send-reply',
			procedure: 'telegram.post.send.message',
			input: z.object({
				chat_id: z.union([z.string(), z.number()]),
				text: z.string(),
			}),
			output: z.object({
				ok: z.boolean(),
				result: z.any().optional(),
			}),
		})
	)
	.commit();

// ==========================================
// EXAMPLE 3: Mixed - Internal Event with Multiple Steps
// ==========================================

/**
 * Data Processing Workflow
 * Triggered by internal "data.uploaded" event
 */
export const dataProcessingWorkflow = workflow('data-processing')
	.name('Data Processing Pipeline')
	.description('Processes uploaded data files')
	.on(
		'data.uploaded',
		step({
			id: 'validate-data',
			procedure: 'data.validate',
			input: z.object({
				fileId: z.string(),
				filename: z.string(),
				size: z.number(),
			}),
			output: z.object({
				valid: z.boolean(),
				errors: z.array(z.string()).optional(),
			}),
		}),
		{ internal: true }
	)
	.step(
		step({
			id: 'transform-data',
			procedure: 'data.transform',
			input: z.object({
				fileId: z.string(),
				transformations: z.array(z.string()),
			}),
			output: z.object({
				transformedFileId: z.string(),
				rowCount: z.number(),
			}),
			config: {
				transformations: ['normalize', 'deduplicate', 'enrich'],
			},
		})
	)
	.step(
		step({
			id: 'load-to-database',
			procedure: 'database.load',
			input: z.object({
				fileId: z.string(),
				table: z.string(),
			}),
			output: z.object({
				loaded: z.boolean(),
				recordsInserted: z.number(),
			}),
			config: {
				table: 'processed_data',
			},
		})
	)
	.step(
		step({
			id: 'send-notification',
			procedure: 'notification.send',
			input: z.object({
				userId: z.string(),
				message: z.string(),
			}),
			output: z.object({
				sent: z.boolean(),
			}),
			config: {
				message: 'Your data has been processed successfully!',
			},
		})
	)
	.commit();

// ==========================================
// EXAMPLE 4: Wildcard Events
// ==========================================

/**
 * Audit Log Workflow
 * Triggered by any "audit.*" event (using wildcards)
 */
export const auditLogWorkflow = workflow('audit-logger')
	.name('Audit Log Handler')
	.description('Logs all audit events')
	.on(
		'audit.*',
		step({
			id: 'log-event',
			procedure: 'audit.log',
			input: z.object({
				eventType: z.string(),
				userId: z.string().optional(),
				timestamp: z.date(),
				data: z.any(),
			}),
			output: z.object({
				logged: z.boolean(),
				logId: z.string(),
			}),
		}),
		{ internal: true }
	)
	.commit();

// Export all workflows
export const eventDrivenWorkflows = [
	userCreatedWorkflow,
	orderPlacedWorkflow,
	telegramMessageWorkflow,
	dataProcessingWorkflow,
	auditLogWorkflow,
];
