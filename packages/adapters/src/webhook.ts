/**
 * Webhook adapter for receiving trigger events
 * 
 * Handles incoming webhook requests from external integrations (Google Drive, Slack, etc.)
 * and routes them to appropriate workflows or event handlers
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { Registry } from "@c4c/core";

/**
 * Webhook event data structure
 */
export interface WebhookEvent {
	/** Unique event ID */
	id: string;
	/** Provider that sent the event (e.g., "googleDrive", "slack") */
	provider: string;
	/** Trigger procedure name that initiated this webhook */
	triggerId?: string;
	/** Subscription/channel ID */
	subscriptionId?: string;
	/** Event type (e.g., "file.changed", "message.sent") */
	eventType?: string;
	/** Event payload from the integration */
	payload: unknown;
	/** Headers from the webhook request */
	headers: Record<string, string>;
	/** Timestamp when event was received */
	timestamp: Date;
}

/**
 * Webhook handler function
 */
export type WebhookHandler = (event: WebhookEvent) => Promise<void> | void;

/**
 * Webhook registry for managing handlers
 */
export class WebhookRegistry {
	private handlers = new Map<string, WebhookHandler[]>();
	private subscriptions = new Map<string, WebhookSubscription>();

	/**
	 * Register a webhook handler for a specific provider
	 */
	registerHandler(provider: string, handler: WebhookHandler): void {
		if (!this.handlers.has(provider)) {
			this.handlers.set(provider, []);
		}
		this.handlers.get(provider)!.push(handler);
	}

	/**
	 * Remove a webhook handler
	 */
	unregisterHandler(provider: string, handler: WebhookHandler): void {
		const handlers = this.handlers.get(provider);
		if (handlers) {
			const index = handlers.indexOf(handler);
			if (index !== -1) {
				handlers.splice(index, 1);
			}
		}
	}

	/**
	 * Get handlers for a provider
	 */
	getHandlers(provider: string): WebhookHandler[] {
		return this.handlers.get(provider) || [];
	}

	/**
	 * Register a webhook subscription
	 */
	registerSubscription(subscription: WebhookSubscription): void {
		this.subscriptions.set(subscription.id, subscription);
	}

	/**
	 * Unregister a webhook subscription
	 */
	unregisterSubscription(subscriptionId: string): void {
		this.subscriptions.delete(subscriptionId);
	}

	/**
	 * Get subscription by ID
	 */
	getSubscription(subscriptionId: string): WebhookSubscription | undefined {
		return this.subscriptions.get(subscriptionId);
	}

	/**
	 * Get all subscriptions for a provider
	 */
	getSubscriptionsByProvider(provider: string): WebhookSubscription[] {
		return Array.from(this.subscriptions.values()).filter(
			(sub) => sub.provider === provider
		);
	}

	/**
	 * Dispatch webhook event to registered handlers
	 */
	async dispatch(event: WebhookEvent): Promise<void> {
		const handlers = this.getHandlers(event.provider);
		
		// Execute all handlers in parallel
		await Promise.all(
			handlers.map(async (handler) => {
				try {
					await handler(event);
				} catch (error) {
					console.error(
						`[Webhook] Handler error for provider ${event.provider}:`,
						error
					);
				}
			})
		);
	}
}

/**
 * Webhook subscription information
 */
export interface WebhookSubscription {
	/** Unique subscription ID */
	id: string;
	/** Provider (e.g., "googleDrive") */
	provider: string;
	/** Trigger procedure that created this subscription */
	triggerId: string;
	/** Workflow ID that should receive events */
	workflowId?: string;
	/** Workflow execution ID that should be resumed */
	executionId?: string;
	/** Channel/resource ID from the provider */
	channelId?: string;
	/** Webhook URL endpoint */
	webhookUrl: string;
	/** Filters for events */
	filters?: Record<string, unknown>;
	/** Creation timestamp */
	createdAt: Date;
	/** Expiration timestamp (if applicable) */
	expiresAt?: Date;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Webhook verification function
 * Used to verify that webhook requests are legitimate
 */
export type WebhookVerifier = (c: Context) => Promise<boolean> | boolean;

/**
 * Provider-specific webhook verifiers
 */
export interface WebhookVerifiers {
	[provider: string]: WebhookVerifier;
}

/**
 * Default webhook verifiers for common providers
 */
export const defaultVerifiers: WebhookVerifiers = {
	/**
	 * Google webhook verification
	 * Verifies X-Goog-Channel-ID and X-Goog-Resource-State headers
	 */
	googleDrive: async (c: Context): Promise<boolean> => {
		const channelId = c.req.header("X-Goog-Channel-ID");
		const resourceState = c.req.header("X-Goog-Resource-State");
		
		// Google sends sync messages on subscription
		if (resourceState === "sync") {
			return true;
		}
		
		return Boolean(channelId && resourceState);
	},

	/**
	 * Slack webhook verification
	 * Verifies X-Slack-Signature
	 */
	slack: async (c: Context): Promise<boolean> => {
		const signature = c.req.header("X-Slack-Signature");
		const timestamp = c.req.header("X-Slack-Request-Timestamp");
		
		// TODO: Implement proper HMAC verification
		return Boolean(signature && timestamp);
	},

	/**
	 * GitHub webhook verification
	 * Verifies X-Hub-Signature-256
	 */
	github: async (c: Context): Promise<boolean> => {
		const signature = c.req.header("X-Hub-Signature-256");
		
		// TODO: Implement proper HMAC verification
		return Boolean(signature);
	},
};

/**
 * Options for webhook router
 */
export interface WebhookRouterOptions {
	/** Base path for webhook endpoints (default: "/webhooks") */
	basePath?: string;
	/** Webhook verifiers by provider */
	verifiers?: WebhookVerifiers;
	/** Enable webhook logging */
	enableLogging?: boolean;
}

/**
 * Create webhook router for Hono app
 */
export function createWebhookRouter(
	registry: Registry,
	webhookRegistry: WebhookRegistry,
	options: WebhookRouterOptions = {}
): Hono {
	const {
		basePath = "/webhooks",
		verifiers = defaultVerifiers,
		enableLogging = true,
	} = options;

	const app = new Hono();

	/**
	 * Generic webhook endpoint: POST /webhooks/:provider
	 * Receives webhook events from any provider
	 */
	app.post("/:provider", async (c: Context) => {
		const provider = c.req.param("provider");

		if (enableLogging) {
			console.log(`[Webhook] Received event from ${provider}`);
		}

		// Verify webhook if verifier exists
		const verifier = verifiers[provider];
		if (verifier) {
			const isValid = await verifier(c);
			if (!isValid) {
				console.error(`[Webhook] Verification failed for ${provider}`);
				return c.json({ error: "Webhook verification failed" }, 401);
			}
		}

		// Parse webhook payload
		let payload: unknown;
		try {
			payload = await c.req.json();
		} catch {
			// Some webhooks send empty body or non-JSON
			payload = await c.req.text();
		}

		// Extract headers
		const headers: Record<string, string> = {};
		c.req.raw.headers.forEach((value: string, key: string) => {
			headers[key] = value;
		});

		// Create webhook event
		const event: WebhookEvent = {
			id: generateEventId(),
			provider,
			payload,
			headers,
			timestamp: new Date(),
		};

		// Try to match with a subscription
		const channelId = headers["x-goog-channel-id"] || headers["x-channel-id"];
		if (channelId) {
			const subscription = webhookRegistry.getSubscription(channelId);
			if (subscription) {
				event.subscriptionId = subscription.id;
				event.triggerId = subscription.triggerId;
				event.eventType = extractEventType(provider, headers, payload);
			}
		}

		if (enableLogging) {
			console.log(`[Webhook] Event:`, {
				id: event.id,
				provider: event.provider,
				subscriptionId: event.subscriptionId,
				eventType: event.eventType,
			});
		}

		// Dispatch to handlers
		try {
			await webhookRegistry.dispatch(event);
			return c.json({ received: true, eventId: event.id }, 200);
		} catch (error) {
			console.error(`[Webhook] Dispatch error:`, error);
			return c.json({ error: "Internal server error" }, 500);
		}
	});

	/**
	 * Subscription management endpoint: POST /webhooks/:provider/subscribe
	 */
	app.post("/:provider/subscribe", async (c: Context) => {
		const provider = c.req.param("provider");
		const body = await c.req.json();

		const subscription: WebhookSubscription = {
			id: body.id || generateSubscriptionId(),
			provider,
			triggerId: body.triggerId,
			workflowId: body.workflowId,
			executionId: body.executionId,
			channelId: body.channelId,
			webhookUrl: body.webhookUrl,
			filters: body.filters,
			createdAt: new Date(),
			expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
			metadata: body.metadata,
		};

		webhookRegistry.registerSubscription(subscription);

		if (enableLogging) {
			console.log(`[Webhook] Registered subscription:`, {
				id: subscription.id,
				provider: subscription.provider,
				triggerId: subscription.triggerId,
			});
		}

		return c.json({ subscription }, 201);
	});

	/**
	 * Unsubscribe endpoint: DELETE /webhooks/:provider/subscribe/:subscriptionId
	 */
	app.delete("/:provider/subscribe/:subscriptionId", async (c: Context) => {
		const subscriptionId = c.req.param("subscriptionId");
		
		webhookRegistry.unregisterSubscription(subscriptionId);

		if (enableLogging) {
			console.log(`[Webhook] Unregistered subscription: ${subscriptionId}`);
		}

		return c.json({ success: true }, 200);
	});

	/**
	 * List subscriptions: GET /webhooks/:provider/subscriptions
	 */
	app.get("/:provider/subscriptions", async (c: Context) => {
		const provider = c.req.param("provider");
		const subscriptions = webhookRegistry.getSubscriptionsByProvider(provider);
		
		return c.json({ subscriptions }, 200);
	});

	return app;
}

/**
 * Helper functions
 */

function generateEventId(): string {
	return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSubscriptionId(): string {
	return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function extractEventType(
	provider: string,
	headers: Record<string, string>,
	payload: unknown
): string | undefined {
	// Provider-specific event type extraction
	switch (provider) {
		case "googleDrive":
			return headers["x-goog-resource-state"];
		case "slack":
			return (payload as { type?: string })?.type;
		case "github":
			return headers["x-github-event"];
		default:
			return undefined;
	}
}

