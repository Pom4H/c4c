import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createExecutionContext, executeProcedure } from "../core/executor.js";
import type { Registry } from "../core/types.js";

/**
 * HTTP adapter for tsdev
 * Demonstrates transport-agnostic principle - same handlers work via HTTP
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
		console.log(`📋 List procedures: http://localhost:${port}/procedures`);
		console.log(`🔧 RPC endpoint: POST http://localhost:${port}/rpc/:procedureName`);
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
