import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createExecutionContext, executeProcedure, type Registry } from "@tsdev/core";
import { generateOpenAPIJSON } from "@tsdev/generators";
import { handleRESTRequest, listRESTRoutes } from "./rest.js";
import { handleWorkflowRequest } from "./workflow-http.js";

/**
 * HTTP adapter for tsdev
 * Supports both RPC and REST endpoints from the same contracts
 */
export function createHttpServer(registry: Registry, port = 3000) {
	const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
		// CORS headers
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type");

		if (req.method === "OPTIONS") {
			res.writeHead(200);
			res.end();
			return;
		}

		// Health check
		if (req.url === "/health" && req.method === "GET") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ status: "ok" }));
			return;
		}

		// List all procedures (introspection endpoint)
		if (req.url === "/procedures" && req.method === "GET") {
			const procedures = Array.from(registry.entries()).map(([name, proc]) => ({
				name,
				description: proc.contract.description,
				metadata: proc.contract.metadata,
			}));

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ procedures }));
			return;
		}

		// OpenAPI specification endpoint
		if (req.url === "/openapi.json" && req.method === "GET") {
			const spec = generateOpenAPIJSON(registry, {
				title: "tsdev API",
				version: "1.0.0",
				description: "Auto-generated API from tsdev contracts",
				servers: [{ url: `http://localhost:${port}`, description: "Development server" }],
			});

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(spec);
			return;
		}

		// Swagger UI (simple HTML version)
		if (req.url === "/docs" && req.method === "GET") {
			const html = `
<!DOCTYPE html>
<html>
<head>
	<title>tsdev API Documentation</title>
	<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
	<div id="swagger-ui"></div>
	<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
	<script>
		SwaggerUIBundle({
			url: '/openapi.json',
			dom_id: '#swagger-ui',
			presets: [
				SwaggerUIBundle.presets.apis,
				SwaggerUIBundle.SwaggerUIStandalonePreset
			],
		});
	</script>
</body>
</html>`;

			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(html);
			return;
		}

		// List REST routes
		if (req.url === "/routes" && req.method === "GET") {
			const routes = listRESTRoutes(registry);

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ routes }));
			return;
		}

		// Try workflow endpoints
		const workflowHandled = await handleWorkflowRequest(req, res, registry);
		if (workflowHandled) {
			return;
		}

		// Try REST endpoints
		const restHandled = await handleRESTRequest(req, res, registry);
		if (restHandled) {
			return;
		}

		// RPC endpoint: POST /rpc/:procedureName
		if (req.method === "POST" && req.url?.startsWith("/rpc/")) {
			const procedureName = req.url.slice(5); // Remove "/rpc/"

			try {
				// Parse request body
				const body = await parseBody(req);
				const input = JSON.parse(body);

				// Get procedure from registry
				const procedure = registry.get(procedureName);
				if (!procedure) {
					res.writeHead(404, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: `Procedure '${procedureName}' not found` }));
					return;
				}

				// Create execution context from HTTP request
				const context = createExecutionContext({
					transport: "http",
					method: req.method,
					url: req.url,
					userAgent: req.headers["user-agent"],
				});

				// Execute procedure
				const result = await executeProcedure(procedure, input, context);

				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify(result));
			} catch (error) {
				console.error("HTTP error:", error);

				const statusCode = error instanceof Error && error.message.includes("not found") ? 404 : 400;
				res.writeHead(statusCode, { "Content-Type": "application/json" });
				res.end(
					JSON.stringify({
						error: error instanceof Error ? error.message : String(error),
					})
				);
			}
			return;
		}

		// 404 for unknown routes
		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: "Not found" }));
	});

	server.listen(port, () => {
		console.log(`🚀 HTTP server listening on http://localhost:${port}`);
		console.log(`\n📚 Documentation:`);
		console.log(`   Swagger UI:       http://localhost:${port}/docs`);
		console.log(`   OpenAPI JSON:     http://localhost:${port}/openapi.json`);
		console.log(`   Procedures:       http://localhost:${port}/procedures`);
		console.log(`   REST Routes:      http://localhost:${port}/routes`);
		console.log(`\n🔄 Workflow:`);
		console.log(`   Node Palette:     http://localhost:${port}/workflow/palette`);
		console.log(`   UI Config:        http://localhost:${port}/workflow/ui-config`);
		console.log(`   Execute:          POST http://localhost:${port}/workflow/execute`);
		console.log(`   Validate:         POST http://localhost:${port}/workflow/validate`);
		console.log(`\n🔧 Endpoints:`);
		console.log(`   RPC:  POST http://localhost:${port}/rpc/:procedureName`);
		console.log(`   REST: http://localhost:${port}/:resource (conventional)`);
		console.log(``);

		// List REST routes
		const routes = listRESTRoutes(registry);
		if (routes.length > 0) {
			console.log(`📍 Available REST routes:`);
			for (const route of routes) {
				console.log(`   ${route.method.padEnd(6)} ${route.path.padEnd(20)} -> ${route.procedure}`);
			}
		}
	});

	return server;
}

/**
 * Parse HTTP request body
 */
function parseBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk) => {
			body += chunk.toString();
		});
		req.on("end", () => resolve(body));
		req.on("error", reject);
	});
}
