/**
 * API Route: GET /api/workflow/executions/[id]/stream
 * Проксирует SSE stream на backend server
 */

import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;

	console.log(`[Proxy] Connecting to SSE stream for execution ${id}`);

	try {
		// Proxy SSE stream from backend server
		const backendUrl = `${config.apiBase}/workflow/executions/${id}/stream`;
		console.log(`[Proxy] Backend URL: ${backendUrl}`);
		
		const response = await fetch(backendUrl, {
			signal: request.signal,
		});

		console.log(`[Proxy] Backend response status: ${response.status}`);

		if (!response.ok) {
			console.error(`[Proxy] Backend returned error status: ${response.status}`);
			return new Response(JSON.stringify({ error: "Failed to connect to stream" }), {
				status: response.status,
				headers: { "Content-Type": "application/json" },
			});
		}

		console.log(`[Proxy] Starting to forward SSE stream for ${id}`);

		// Listen for client disconnect
		request.signal.addEventListener('abort', () => {
			console.log(`[Proxy] Client disconnected from stream ${id}`);
		});

		// Forward the SSE stream
		return new Response(response.body, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error(`[Proxy] Error proxying SSE stream for ${id}:`, error);
		return new Response(JSON.stringify({ error: "Failed to connect to stream" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
