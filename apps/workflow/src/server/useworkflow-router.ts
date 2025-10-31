import { Hono, type Context } from "hono";
import { ZodError } from "zod";
import {
  getRun,
  getRunStreamUrl,
  getRunsStreamUrl,
  getWorkflow,
  listRuns,
  listWorkflows,
  startRun,
} from "@/lib/useworkflow/client";

const app = new Hono();

function jsonError(c: Context, error: unknown, fallbackStatus = 500) {
  console.error("[workflow-api]", error);

  if (error instanceof ZodError) {
    return c.json({ error: "Invalid payload", issues: error.format() }, 400);
  }

  if (error instanceof Error) {
    const status = typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : fallbackStatus;

    return c.json({ error: error.message }, status);
  }

  return c.json({ error: "Unknown error" }, fallbackStatus);
}

app.get("/api/workflow/definitions", async (c) => {
  try {
    const workflows = await listWorkflows();
    return c.json(
      workflows.map((wf) => ({
        id: wf.id,
        name: wf.name,
        version: wf.version,
        description: wf.description,
        entryStep: wf.entryStep,
        stepCount: wf.steps.length,
        metadata: wf.metadata,
      })),
    );
  } catch (error) {
    return jsonError(c, error);
  }
});

app.get("/api/workflow/definitions/:id", async (c) => {
  try {
    const workflow = await getWorkflow(c.req.param("id"));
    return c.json(workflow);
  } catch (error) {
    return jsonError(c, error, 404);
  }
});

app.post("/api/workflow/execute", async (c) => {
  try {
    const payload = await c.req.json();
    const workflowId = (payload?.workflowId ?? payload?.id) as string | undefined;

    if (!workflowId) {
      return c.json({ error: "workflowId is required" }, 400);
    }

    const run = await startRun({
      workflowId,
      input: payload?.input ?? {},
      options: payload?.options,
    });

    return c.json(run, 201);
  } catch (error) {
    return jsonError(c, error, 400);
  }
});

app.get("/api/workflow/executions", async (c) => {
  try {
    const { runs, stats } = await listRuns();
    return c.json({ runs, stats });
  } catch (error) {
    return jsonError(c, error);
  }
});

app.get("/api/workflow/executions/:id", async (c) => {
  try {
    const run = await getRun(c.req.param("id"));
    return c.json(run);
  } catch (error) {
    return jsonError(c, error, 404);
  }
});

async function proxyStream(request: Request, targetUrl: string): Promise<Response> {
  const upstream = await fetch(targetUrl, {
    headers: request.headers,
    signal: request.signal,
  });

  if (!upstream.ok || !upstream.body) {
    const body = await upstream.text();
    const message = body || `Failed to proxy stream (${upstream.status})`;
    return new Response(JSON.stringify({ error: message }), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

app.get("/api/workflow/executions-stream", async (c) => {
  try {
    return await proxyStream(c.req.raw, getRunsStreamUrl());
  } catch (error) {
    return jsonError(c, error);
  }
});

app.get("/api/workflow/executions/:id/stream", async (c) => {
  try {
    const runId = c.req.param("id");
    return await proxyStream(c.req.raw, getRunStreamUrl(runId));
  } catch (error) {
    return jsonError(c, error);
  }
});

export const workflowRouter = app;

