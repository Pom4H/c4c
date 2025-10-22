/**
 * API Route: GET /api/workflow/executions/[id]/stream
 * SSE stream для live updates execution
 */

import { subscribeToExecution } from "@c4c/workflow";

export const dynamic = "force-dynamic";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const executionId = id;

	// Create SSE stream
	const encoder = new TextEncoder();
	
	const stream = new ReadableStream({
		start(controller) {
			// Subscribe to workflow events
			const unsubscribe = subscribeToExecution(executionId, (event) => {
				try {
					const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
					controller.enqueue(encoder.encode(data));
				} catch (error) {
					console.error("Failed to send SSE event:", error);
				}
			});

			// Keep connection alive
			const keepAlive = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(": keepalive\n\n"));
				} catch {
					clearInterval(keepAlive);
				}
			}, 15000);

			// Cleanup on close
			request.signal.addEventListener("abort", () => {
				clearInterval(keepAlive);
				unsubscribe();
				try {
					controller.close();
				} catch {
					// Already closed
				}
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
		},
	});
}
