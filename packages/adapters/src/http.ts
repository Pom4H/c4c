import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import type { Registry } from "@c4c/core";
import { createRestRouter, listRESTRoutes } from "./rest.js";
import { createWorkflowRouter } from "./workflow-http.js";
import { createRpcRouter } from "./rpc.js";
import { createWebhookRouter, WebhookRegistry } from "./webhook.js";

export interface HttpAppOptions {
	port?: number;
	enableDocs?: boolean;
	enableRpc?: boolean;
	enableRest?: boolean;
	enableWorkflow?: boolean;
	enableWebhooks?: boolean;
	workflowsPath?: string;
	webhookRegistry?: WebhookRegistry;
}

/**
 * HTTP adapter for c4c
 * Builds a Hono application and starts a Node server
 */
export function createHttpServer(registry: Registry, port = 3000, options: HttpAppOptions = {}) {
	const finalOptions: HttpAppOptions = { port, ...options };
	const app = buildHttpApp(registry, finalOptions);
	const server = serve({
		fetch: app.fetch,
		port: finalOptions.port ?? port,
	});

	logStartup(registry, finalOptions);
	return server;
}

export function buildHttpApp(registry: Registry, options: HttpAppOptions = {}) {
	const {
		port = 3000,
		enableDocs = true,
		enableRpc = true,
		enableRest = true,
		enableWorkflow = true,
		enableWebhooks = true,
		workflowsPath = process.env.c4c_WORKFLOWS_DIR ?? "workflows",
		webhookRegistry = new WebhookRegistry(),
	} = options;

	const app = new OpenAPIHono({
		defaultHook: (result, c) => {
			if (!result.success) {
				return c.json(
					{
						error: "Validation Error",
						details: result.error.flatten(),
					},
					400
				);
			}
		},
	});

	// CORS middleware
	app.use("*", async (c, next) => {
		c.header("Access-Control-Allow-Origin", "*");
		c.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
		c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

		if (c.req.method === "OPTIONS") {
			return c.body(null, 204);
		}

		await next();
	});

	// Health check endpoint
	app.get("/health", (c) => c.json({ status: "ok" }, 200));

	// Procedures list endpoint
	app.get("/procedures", (c) => {
		const procedures = Array.from(registry.entries()).map(([name, proc]) => ({
			name,
			description: proc.contract.description,
			metadata: proc.contract.metadata,
		}));
		return c.json({ procedures }, 200);
	});

	if (enableDocs) {
		// Serve OpenAPI spec at /openapi endpoint using @hono/zod-openapi
		app.doc("/openapi.json", {
			openapi: "3.1.0",
			info: {
				title: "c4c API",
				version: "1.0.0",
				description: "Auto-generated API from c4c contracts with Zod schemas",
			},
			servers: [
				{
					url: `http://localhost:${port}`,
					description: "Development server",
				},
			],
		});

		// Serve Swagger UI using @hono/swagger-ui
		app.get("/docs", swaggerUI({ url: "/openapi.json" }));
	}

	if (enableRest) {
		app.get("/routes", (c) => {
			const routes = listRESTRoutes(registry);
			return c.json({ routes }, 200);
		});
	}

	if (enableWorkflow) {
		app.route("/", createWorkflowRouter(registry, { workflowsPath }));
	}

	if (enableWebhooks) {
		app.route("/webhooks", createWebhookRouter(registry, webhookRegistry));
	}

	if (enableRest) {
		app.route("/", createRestRouter(registry));
	}

	if (enableRpc) {
		app.route("/", createRpcRouter(registry));
	}

	app.notFound((c) => c.json({ error: "Not found" }, 404));

	return app;
}

function logStartup(registry: Registry, options: HttpAppOptions) {
	if (process.env.c4c_QUIET === "1") {
		return;
	}

	const {
		port = 3000,
		enableDocs = true,
		enableRpc = true,
		enableRest = true,
		enableWorkflow = true,
		enableWebhooks = true,
		workflowsPath = process.env.c4c_WORKFLOWS_DIR ?? "workflows",
	} = options;

	console.log(`🚀 HTTP server listening on http://localhost:${port}`);
	console.log(`\n📚 Documentation:`);
	console.log(`   Procedures:       http://localhost:${port}/procedures`);
	if (enableDocs) {
		console.log(`   Swagger UI:       http://localhost:${port}/docs`);
		console.log(`   OpenAPI JSON:     http://localhost:${port}/openapi.json`);
	}
	if (enableRest) {
		console.log(`   REST Routes:      http://localhost:${port}/routes`);
	}
	if (enableWorkflow) {
		console.log(`\n🔄 Workflow:`);
		console.log(`   Node Palette:     http://localhost:${port}/workflow/palette`);
		console.log(`   UI Config:        http://localhost:${port}/workflow/ui-config`);
		console.log(`   Definitions:      http://localhost:${port}/workflow/definitions`);
		console.log(`   Execute:          POST http://localhost:${port}/workflow/execute`);
		console.log(`   Validate:         POST http://localhost:${port}/workflow/validate`);
		console.log(`   Resume:           POST http://localhost:${port}/workflow/resume`);
		console.log(`   Stream:           GET  http://localhost:${port}/workflow/executions/:id/stream`);
		console.log(`   Files:            ${workflowsPath}`);
	}
	console.log(`\n🔧 Endpoints:`);
	if (enableRpc) {
		console.log(`   RPC:  POST http://localhost:${port}/rpc/:procedureName`);
	}
	if (enableRest) {
		console.log(`   REST: http://localhost:${port}/:resource (conventional)`);
	}
	if (enableWebhooks) {
		console.log(`\n📡 Webhooks:`);
		console.log(`   Receive:      POST http://localhost:${port}/webhooks/:provider`);
		console.log(`   Subscribe:    POST http://localhost:${port}/webhooks/:provider/subscribe`);
		console.log(`   Unsubscribe:  DELETE http://localhost:${port}/webhooks/:provider/subscribe/:id`);
		console.log(`   List:         GET http://localhost:${port}/webhooks/:provider/subscriptions`);
	}
	console.log(``);

	if (enableRest) {
		const routes = listRESTRoutes(registry);
		if (routes.length > 0) {
			console.log(`📍 Available REST routes:`);
			for (const route of routes) {
				console.log(`   ${route.method.padEnd(6)} ${route.path.padEnd(20)} -> ${route.procedure}`);
			}
		}
	}
}
