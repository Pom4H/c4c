/**
 * Test server that serves the Workflow DevKit endpoints — pure ESM.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createLocalWorld } from "@workflow/world-local";
import { setWorld } from "workflow/runtime";

export async function startServer(port: number) {
	const flow = await import("./.well-known/workflow/v1/flow.mjs");
	const step = await import("./.well-known/workflow/v1/step.mjs");
	const webhook = await import("./.well-known/workflow/v1/webhook.mjs");

	const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
		const addr = server.address();
		const p = typeof addr === "object" && addr ? addr.port : port;
		const url = new URL(req.url || "/", `http://localhost:${p}`);
		const method = req.method || "GET";

		let body = "";
		for await (const chunk of req) body += chunk;

		const headers = new Headers();
		for (const [k, v] of Object.entries(req.headers)) {
			if (v) headers.set(k, Array.isArray(v) ? v[0] : v);
		}

		const init: RequestInit = { method, headers };
		if (method !== "GET" && method !== "HEAD" && body) init.body = body;
		const request = new Request(url.toString(), init);

		try {
			let response: Response;
			if (url.pathname === "/.well-known/workflow/v1/flow" && method === "POST") {
				response = await flow.POST(request);
			} else if (url.pathname === "/.well-known/workflow/v1/step" && method === "POST") {
				response = await step.POST(request);
			} else if (url.pathname.startsWith("/.well-known/workflow/v1/webhook/") && method === "POST") {
				response = await webhook.POST(request);
			} else if (url.pathname === "/health") {
				response = new Response(JSON.stringify({ ok: true }), {
					status: 200, headers: { "Content-Type": "application/json" },
				});
			} else {
				response = new Response("Not Found", { status: 404 });
			}
			res.writeHead(response.status, Object.fromEntries(response.headers));
			res.end(Buffer.from(await response.arrayBuffer()));
		} catch (error) {
			console.error("Server error:", error);
			res.writeHead(500);
			res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
		}
	});

	// Listen first to get the actual port
	await new Promise<void>((r) => server.listen(port, r));
	const addr = server.address();
	const actualPort = typeof addr === "object" && addr ? addr.port : port;
	const baseUrl = `http://localhost:${actualPort}`;

	// Set env vars BEFORE creating the world — world-local reads these
	process.env.PORT = String(actualPort);
	process.env.WORKFLOW_LOCAL_BASE_URL = baseUrl;
	process.env.DEPLOYMENT_URL = baseUrl;

	const world = await createLocalWorld();
	setWorld(world);

	console.log(`Test server listening on ${baseUrl}`);

	return {
		server,
		baseUrl,
		close: () => {
			delete process.env.PORT;
			delete process.env.WORKFLOW_LOCAL_BASE_URL;
			delete process.env.DEPLOYMENT_URL;
			return new Promise<void>((r) => server.close(() => r()));
		},
	};
}
