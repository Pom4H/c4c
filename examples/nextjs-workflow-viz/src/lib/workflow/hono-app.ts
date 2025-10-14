/**
 * Hono app for workflow execution with SSE
 * Using real tsdev framework
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { executeWorkflow } from "./runtime-integration";
import {
  mathWorkflow,
  conditionalWorkflow,
  parallelWorkflow,
  complexWorkflow,
} from "./examples";
import type { WorkflowDefinition, WorkflowExecutionResult } from "./types";

const workflows: Record<string, WorkflowDefinition> = {
  "math-calculation": mathWorkflow,
  "conditional-processing": conditionalWorkflow,
  "parallel-tasks": parallelWorkflow,
  "complex-workflow": complexWorkflow,
};

const app = new Hono();

// Get all available workflows
app.get("/api/workflows", (c) => {
  const workflowList = Object.values(workflows).map((wf) => ({
    id: wf.id,
    name: wf.name,
    description: wf.description,
    version: wf.version,
    nodeCount: wf.nodes.length,
    metadata: wf.metadata,
  }));
  return c.json(workflowList);
});

// Get workflow definition by ID
app.get("/api/workflows/:id", (c) => {
  const workflowId = c.req.param("id");
  const workflow = workflows[workflowId];
  
  if (!workflow) {
    return c.json({ error: `Workflow ${workflowId} not found` }, 404);
  }
  
  return c.json(workflow);
});

// Execute workflow with SSE streaming
app.post("/api/workflows/:id/execute", async (c) => {
  const workflowId = c.req.param("id");
  const workflow = workflows[workflowId];
  
  if (!workflow) {
    return c.json({ error: `Workflow ${workflowId} not found` }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const input = body.input || {};

  return streamSSE(c, async (stream) => {
    try {
      // Send start event
      await stream.writeSSE({
        data: JSON.stringify({
          type: "start",
          workflowId,
          workflowName: workflow.name,
          timestamp: Date.now(),
        }),
        event: "workflow-start",
      });

      // Execute workflow
      const result: WorkflowExecutionResult = await executeWorkflow(workflow, input);

      // Send progress events for each node executed
      for (const nodeId of result.nodesExecuted) {
        await stream.writeSSE({
          data: JSON.stringify({
            type: "node-executed",
            nodeId,
            timestamp: Date.now(),
          }),
          event: "workflow-progress",
        });
      }

      // Send completion event
      await stream.writeSSE({
        data: JSON.stringify({
          type: "complete",
          result,
          timestamp: Date.now(),
        }),
        event: "workflow-complete",
      });

    } catch (error) {
      // Send error event
      await stream.writeSSE({
        data: JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        }),
        event: "workflow-error",
      });
    }
  });
});

export default app;
