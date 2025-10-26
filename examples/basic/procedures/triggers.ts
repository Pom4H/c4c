/**
 * Example Trigger Procedures
 * 
 * These trigger procedures work for BOTH:
 * - Internal events (monolith): emitTriggerEvent()
 * - External events (microservices): webhooks
 * 
 * Workflows using these triggers don't change when refactoring!
 */

import { createTriggerProcedure } from '@c4c/workflow';
import { z } from 'zod';

// ==========================================
// USER TRIGGERS
// ==========================================

export const userCreatedTrigger = createTriggerProcedure(
	'user.trigger.created',
	z.object({
		userId: z.string(),
		email: z.string(),
		name: z.string(),
		metadata: z.record(z.unknown()).optional(),
	}),
	{
		description: 'Triggered when a new user is created',
		provider: 'users',
		eventTypes: ['created'],
		exposure: 'internal', // Change to 'external' for microservices
	}
);

export const userUpdatedTrigger = createTriggerProcedure(
	'user.trigger.updated',
	z.object({
		userId: z.string(),
		changes: z.record(z.unknown()),
	}),
	{
		description: 'Triggered when a user is updated',
		provider: 'users',
		eventTypes: ['updated'],
		exposure: 'internal',
	}
);

export const userDeletedTrigger = createTriggerProcedure(
	'user.trigger.deleted',
	z.object({
		userId: z.string(),
	}),
	{
		description: 'Triggered when a user is deleted',
		provider: 'users',
		eventTypes: ['deleted'],
		exposure: 'internal',
	}
);

// ==========================================
// ORDER TRIGGERS
// ==========================================

export const orderPlacedTrigger = createTriggerProcedure(
	'order.trigger.placed',
	z.object({
		orderId: z.string(),
		userId: z.string(),
		amount: z.number(),
		currency: z.string().default('USD'),
		items: z.array(z.object({
			productId: z.string(),
			quantity: z.number(),
			price: z.number(),
		})),
	}),
	{
		description: 'Triggered when an order is placed',
		provider: 'orders',
		eventTypes: ['placed'],
		exposure: 'internal',
	}
);

export const orderCompletedTrigger = createTriggerProcedure(
	'order.trigger.completed',
	z.object({
		orderId: z.string(),
		completedAt: z.date(),
	}),
	{
		description: 'Triggered when an order is completed',
		provider: 'orders',
		eventTypes: ['completed'],
		exposure: 'internal',
	}
);

export const orderCancelledTrigger = createTriggerProcedure(
	'order.trigger.cancelled',
	z.object({
		orderId: z.string(),
		reason: z.string().optional(),
	}),
	{
		description: 'Triggered when an order is cancelled',
		provider: 'orders',
		eventTypes: ['cancelled'],
		exposure: 'internal',
	}
);

// ==========================================
// PAYMENT TRIGGERS
// ==========================================

export const paymentSucceededTrigger = createTriggerProcedure(
	'payment.trigger.succeeded',
	z.object({
		paymentId: z.string(),
		orderId: z.string(),
		amount: z.number(),
		transactionId: z.string(),
	}),
	{
		description: 'Triggered when a payment succeeds',
		provider: 'payments',
		eventTypes: ['succeeded'],
		exposure: 'internal',
	}
);

export const paymentFailedTrigger = createTriggerProcedure(
	'payment.trigger.failed',
	z.object({
		paymentId: z.string(),
		orderId: z.string(),
		error: z.string(),
	}),
	{
		description: 'Triggered when a payment fails',
		provider: 'payments',
		eventTypes: ['failed'],
		exposure: 'internal',
	}
);

// ==========================================
// NOTIFICATION TRIGGERS
// ==========================================

export const notificationSentTrigger = createTriggerProcedure(
	'notification.trigger.sent',
	z.object({
		notificationId: z.string(),
		userId: z.string(),
		channel: z.enum(['email', 'sms', 'push']),
		sentAt: z.date(),
	}),
	{
		description: 'Triggered when a notification is sent',
		provider: 'notifications',
		eventTypes: ['sent'],
		exposure: 'internal',
	}
);

// Export all triggers
export const triggers = [
	userCreatedTrigger,
	userUpdatedTrigger,
	userDeletedTrigger,
	orderPlacedTrigger,
	orderCompletedTrigger,
	orderCancelledTrigger,
	paymentSucceededTrigger,
	paymentFailedTrigger,
	notificationSentTrigger,
];
