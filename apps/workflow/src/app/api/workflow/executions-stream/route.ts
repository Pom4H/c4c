/**
 * API Route: GET /api/workflow/executions-stream
 * Proxies SSE stream for updates of all executions
 */

import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	try {
		// Proxy SSE stream from backend server
		const response = await fetch(`${config.apiBase}/workflow/executions-stream`, {
			signal: request.signal,
		});

		if (!response.ok) {
			return new Response(JSON.stringify({ error: "Failed to connect to stream" }), {
				status: response.status,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Forward the SSE stream
		return new Response(response.body, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Failed to proxy SSE stream:", error);
		return new Response(JSON.stringify({ error: "Failed to connect to stream" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
