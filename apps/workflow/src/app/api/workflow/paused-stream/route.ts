/**
 * API Route: GET /api/workflow/paused-stream
 * Server-Sent Events stream for real-time paused workflows updates
 */

import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // In production, this would proxy to backend SSE stream
    // For now, return a basic SSE stream with mock data
    
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send initial paused workflows list
        const initialData = {
          pausedWorkflows: [
            {
              executionId: "wf_exec_123_abc",
              workflowId: "process-order",
              workflowName: "Order Processing",
              pausedAt: "wait-approval",
              pausedTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              waitingFor: ["orders.trigger.approved"],
              timeoutAt: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
              variables: {
                orderId: "order_12345",
                customerEmail: "john@example.com",
                riskScore: 85,
              },
            },
            {
              executionId: "wf_exec_456_def",
              workflowId: "process-order",
              workflowName: "Order Processing",
              pausedAt: "wait-payment",
              pausedTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
              waitingFor: ["payment-service.payments.trigger.completed"],
              timeoutAt: new Date(Date.now() + 71.5 * 60 * 60 * 1000).toISOString(),
              variables: {
                orderId: "order_12346",
                customerEmail: "jane@example.com",
              },
            },
          ],
        };

        controller.enqueue(
          encoder.encode(`event: paused.initial\ndata: ${JSON.stringify(initialData)}\n\n`)
        );

        // Keep connection alive with heartbeat
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch (error) {
            clearInterval(heartbeat);
          }
        }, 30000); // Every 30 seconds

        // Cleanup on close
        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          try {
            controller.close();
          } catch (e) {
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
  } catch (error) {
    console.error("[API] Failed to start SSE stream:", error);
    return new Response(
      JSON.stringify({ error: "Failed to start stream" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
