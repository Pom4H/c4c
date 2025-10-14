/**
 * Hono SSE adapter for workflow system
 * Provides real-time workflow execution updates via Server-Sent Events
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { createExecutionContext, executeProcedure } from "../core/executor.js";
import type { Registry } from "../core/types.js";
import { executeWorkflow, validateWorkflow } from "../workflow/runtime.js";
import type { WorkflowDefinition, WorkflowExecutionResult } from "../workflow/types.js";

/**
 * Create Hono app with workflow SSE endpoints
 */
export function createWorkflowSSEApp(registry: Registry) {
  const app = new Hono();

  // CORS middleware
  app.use("*", async (c, next) => {
    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type");
    
    if (c.req.method === "OPTIONS") {
      return c.text("", 200);
    }
    
    await next();
  });

  // Health check
  app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // List available procedures
  app.get("/procedures", (c) => {
    const procedures = Array.from(registry.entries()).map(([name, proc]) => ({
      name,
      description: proc.contract.description,
      metadata: proc.contract.metadata,
    }));

    return c.json({ procedures });
  });

  // Execute workflow with SSE updates
  app.post("/workflow/execute-sse", async (c) => {
    try {
      const body = await c.req.json();
      const { workflow, input } = body as {
        workflow: WorkflowDefinition;
        input?: Record<string, unknown>;
      };

      // Validate workflow
      const errors = validateWorkflow(workflow, registry);
      if (errors.length > 0) {
        return c.json({ errors }, 400);
      }

      // Execute workflow with SSE streaming
      return streamSSE(c, async (stream) => {
        const executionId = `wf_exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        
        try {
          // Send initial event
          await stream.writeSSE({
            data: JSON.stringify({
              type: "workflow_started",
              executionId,
              workflowId: workflow.id,
              workflowName: workflow.name,
              timestamp: new Date().toISOString(),
            }),
          });

          // Execute workflow with progress updates
          const result = await executeWorkflowWithProgress(
            workflow,
            registry,
            input || {},
            executionId,
            async (update) => {
              await stream.writeSSE({
                data: JSON.stringify(update),
              });
            }
          );

          // Send final result
          await stream.writeSSE({
            data: JSON.stringify({
              type: "workflow_completed",
              executionId,
              result,
              timestamp: new Date().toISOString(),
            }),
          });

        } catch (error) {
          // Send error event
          await stream.writeSSE({
            data: JSON.stringify({
              type: "workflow_error",
              executionId,
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            }),
          });
        }
      });

    } catch (error) {
      return c.json({
        error: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  // Execute single procedure with SSE updates
  app.post("/procedure/execute-sse/:procedureName", async (c) => {
    const procedureName = c.req.param("procedureName");
    
    try {
      const body = await c.req.json();
      const input = body as Record<string, unknown>;

      const procedure = registry.get(procedureName);
      if (!procedure) {
        return c.json({ error: `Procedure '${procedureName}' not found` }, 404);
      }

      return streamSSE(c, async (stream) => {
        const executionId = `proc_exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        
        try {
          // Send initial event
          await stream.writeSSE({
            data: JSON.stringify({
              type: "procedure_started",
              executionId,
              procedureName,
              timestamp: new Date().toISOString(),
            }),
          });

          // Create execution context
          const context = createExecutionContext({
            transport: "sse",
            procedureName,
            executionId,
          });

          // Execute procedure with progress updates
          const result = await executeProcedureWithProgress(
            procedure,
            input,
            context,
            async (update) => {
              await stream.writeSSE({
                data: JSON.stringify(update),
              });
            }
          );

          // Send final result
          await stream.writeSSE({
            data: JSON.stringify({
              type: "procedure_completed",
              executionId,
              procedureName,
              result,
              timestamp: new Date().toISOString(),
            }),
          });

        } catch (error) {
          // Send error event
          await stream.writeSSE({
            data: JSON.stringify({
              type: "procedure_error",
              executionId,
              procedureName,
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            }),
          });
        }
      });

    } catch (error) {
      return c.json({
        error: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  // Validate workflow
  app.post("/workflow/validate", async (c) => {
    try {
      const body = await c.req.json();
      const workflow = body as WorkflowDefinition;

      const errors = validateWorkflow(workflow, registry);

      return c.json({
        valid: errors.length === 0,
        errors,
      });
    } catch (error) {
      return c.json({
        error: error instanceof Error ? error.message : String(error),
      }, 400);
    }
  });

  return app;
}

/**
 * Execute workflow with progress updates via SSE
 */
async function executeWorkflowWithProgress(
  workflow: WorkflowDefinition,
  registry: Registry,
  initialInput: Record<string, unknown>,
  executionId: string,
  onUpdate: (update: any) => Promise<void>
): Promise<WorkflowExecutionResult> {
  const startTime = Date.now();

  // Send workflow configuration
  await onUpdate({
    type: "workflow_config",
    executionId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    nodeCount: workflow.nodes.length,
    startNode: workflow.startNode,
    timestamp: new Date().toISOString(),
  });

  const nodesExecuted: string[] = [];
  let currentNodeId: string | undefined = workflow.startNode;
  let nodeIndex = 0;

  try {
    while (currentNodeId) {
      const node = workflow.nodes.find((n) => n.id === currentNodeId);
      if (!node) {
        throw new Error(`Node ${currentNodeId} not found in workflow`);
      }

      // Send node start event
      await onUpdate({
        type: "node_started",
        executionId,
        nodeId: node.id,
        nodeType: node.type,
        nodeIndex,
        procedureName: node.procedureName,
        timestamp: new Date().toISOString(),
      });

      // Execute node (simplified version for SSE)
      const nextNodeId = await executeNodeWithProgress(
        node,
        registry,
        executionId,
        onUpdate
      );

      nodesExecuted.push(node.id);

      // Send node completed event
      await onUpdate({
        type: "node_completed",
        executionId,
        nodeId: node.id,
        nodeType: node.type,
        nextNodeId,
        timestamp: new Date().toISOString(),
      });

      currentNodeId = nextNodeId;
      nodeIndex++;
    }

    const executionTime = Date.now() - startTime;

    return {
      executionId,
      status: "completed",
      outputs: {},
      executionTime,
      nodesExecuted,
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;

    return {
      executionId,
      status: "failed",
      outputs: {},
      error: error instanceof Error ? error : new Error(String(error)),
      executionTime,
      nodesExecuted,
    };
  }
}

/**
 * Execute single node with progress updates
 */
async function executeNodeWithProgress(
  node: any,
  registry: Registry,
  executionId: string,
  onUpdate: (update: any) => Promise<void>
): Promise<string | undefined> {
  if (node.type === "procedure" && node.procedureName) {
    const procedure = registry.get(node.procedureName);
    if (!procedure) {
      throw new Error(`Procedure ${node.procedureName} not found in registry`);
    }

    // Send procedure execution event
    await onUpdate({
      type: "procedure_executing",
      executionId,
      nodeId: node.id,
      procedureName: node.procedureName,
      timestamp: new Date().toISOString(),
    });

    // Simulate procedure execution (simplified)
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // Send procedure completed event
    await onUpdate({
      type: "procedure_executed",
      executionId,
      nodeId: node.id,
      procedureName: node.procedureName,
      timestamp: new Date().toISOString(),
    });
  }

  // Return next node ID
  return typeof node.next === "string" ? node.next : node.next?.[0];
}

/**
 * Execute procedure with progress updates
 */
async function executeProcedureWithProgress(
  procedure: any,
  input: Record<string, unknown>,
  context: any,
  onUpdate: (update: any) => Promise<void>
): Promise<any> {
  // Send input validation event
  await onUpdate({
    type: "procedure_input_validated",
    executionId: context.executionId,
    procedureName: context.procedureName,
    inputKeys: Object.keys(input),
    timestamp: new Date().toISOString(),
  });

  // Send execution start event
  await onUpdate({
    type: "procedure_execution_started",
    executionId: context.executionId,
    procedureName: context.procedureName,
    timestamp: new Date().toISOString(),
  });

  // Simulate procedure execution with progress updates
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    await onUpdate({
      type: "procedure_progress",
      executionId: context.executionId,
      procedureName: context.procedureName,
      step: i + 1,
      totalSteps: steps,
      progress: Math.round(((i + 1) / steps) * 100),
      timestamp: new Date().toISOString(),
    });
  }

  // Execute actual procedure
  const result = await executeProcedure(procedure, input, context);

  // Send execution completed event
  await onUpdate({
    type: "procedure_execution_completed",
    executionId: context.executionId,
    procedureName: context.procedureName,
    resultKeys: Object.keys(result as object),
    timestamp: new Date().toISOString(),
  });

  return result;
}