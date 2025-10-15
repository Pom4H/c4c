import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { executeWorkflow } from "@/lib/workflow/runtime";
import type { WorkflowEvent } from "@tsdev/workflow";
import {
  mathWorkflow,
  conditionalWorkflow,
  parallelWorkflow,
  complexWorkflow,
  errorWorkflow,
} from "@/lib/workflow/examples";

const workflows = {
  "math-calculation": mathWorkflow,
  "conditional-processing": conditionalWorkflow,
  "parallel-tasks": parallelWorkflow,
  "complex-workflow": complexWorkflow,
  "error-demo": errorWorkflow,
} as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workflowId = searchParams.get("id");
  if (!workflowId || !(workflowId in workflows)) {
    return new Response("Missing or invalid workflow id", { status: 400 });
  }

  const encoder = new TextEncoder();

  // Create a ReadableStream that emits SSE events
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const executionId = `wf_exec_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 9)}`;

      const send = (event: WorkflowEvent) => {
        controller.enqueue(
          encoder.encode(`event: ${event.type}\n` + `data: ${JSON.stringify(event)}\n\n`)
        );
      };

      // Heartbeat to keep connection alive (every 15s)
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: keep-alive\n\n`));
      }, 15000);

      // Dynamic import to avoid initializing core tracer too early
      const { subscribeToExecution } = await import("@tsdev/workflow/src/events");
      const unsubscribe = subscribeToExecution(executionId, (evt: WorkflowEvent) => {
        send(evt);
        // We don't close immediately; we'll send final result below
      });

      // Kick off execution (fire and forget)
      executeWorkflow(workflows[workflowId as keyof typeof workflows], {}, { executionId })
        .then((result) => {
          // After completion, send final result with spans for UI
          const finalEvent: WorkflowEvent = {
            type: "workflow.result",
            workflowId: result.resumeState?.workflowId || workflows[workflowId as keyof typeof workflows].id,
            executionId: result.executionId,
            result,
          } as WorkflowEvent;
          send(finalEvent);
          clearInterval(heartbeat);
          unsubscribe();
          controller.close();
        })
        .catch((err) => {
          const errorEvent: WorkflowEvent = {
            type: "workflow.failed",
            workflowId: workflows[workflowId as keyof typeof workflows].id,
            executionId,
            executionTime: 0,
            nodesExecuted: [],
            error: err instanceof Error ? err.message : String(err),
          };
          send(errorEvent);
          clearInterval(heartbeat);
          unsubscribe();
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
