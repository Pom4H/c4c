/**
 * Workflow runtime executor with OpenTelemetry integration
 */

import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowExecutionResult,
  TraceSpan,
} from "./types";

/**
 * Simple in-memory trace collector
 */
class TraceCollector {
  private spans: TraceSpan[] = [];
  private currentSpanId = 0;
  private traceId: string;

  constructor() {
    this.traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  startSpan(
    name: string,
    attributes: Record<string, string | number | boolean> = {},
    parentSpanId?: string
  ): string {
    const spanId = `span_${++this.currentSpanId}`;
    const span: TraceSpan = {
      spanId,
      traceId: this.traceId,
      parentSpanId,
      name,
      kind: "INTERNAL",
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      status: { code: "UNSET" },
      attributes,
    };
    this.spans.push(span);
    return spanId;
  }

  endSpan(
    spanId: string,
    status: "OK" | "ERROR" = "OK",
    error?: string
  ): void {
    const span = this.spans.find((s) => s.spanId === spanId);
    if (span) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
      span.status = { code: status, message: error };
    }
  }

  addEvent(
    spanId: string,
    eventName: string,
    attributes?: Record<string, unknown>
  ): void {
    const span = this.spans.find((s) => s.spanId === spanId);
    if (span) {
      if (!span.events) span.events = [];
      span.events.push({
        name: eventName,
        timestamp: Date.now(),
        attributes,
      });
    }
  }

  getSpans(): TraceSpan[] {
    return [...this.spans];
  }

  getTraceId(): string {
    return this.traceId;
  }
}

/**
 * Mock procedure registry for demo
 */
const mockProcedures: Record<string, (input: any) => Promise<any>> = {
  "math.add": async (input: { a: number; b: number }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { result: input.a + input.b };
  },
  "math.multiply": async (input: { a: number; b?: number }) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const b = input.b ?? input.result ?? 1;
    return { result: input.a * b };
  },
  "math.subtract": async (input: { a: number; b: number }) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { result: input.a - input.b };
  },
  "data.fetch": async (input: { userId: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return {
      userId: input.userId,
      name: "John Doe",
      isPremium: true,
      data: { score: 95 },
    };
  },
  "data.process": async (input: { data: any; mode: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      processedData: `${input.mode} processing completed`,
      score: 100,
    };
  },
  "data.save": async (input: any) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { saved: true, timestamp: Date.now() };
  },
};

/**
 * Execute a workflow with tracing
 */
export async function executeWorkflow(
  workflow: WorkflowDefinition,
  initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const startTime = Date.now();
  const collector = new TraceCollector();

  const workflowSpanId = collector.startSpan("workflow.execute", {
    "workflow.id": workflow.id,
    "workflow.name": workflow.name,
    "workflow.execution_id": executionId,
  });

  const context = {
    workflowId: workflow.id,
    executionId,
    variables: { ...workflow.variables, ...initialInput },
    nodeOutputs: new Map<string, unknown>(),
  };

  const nodesExecuted: string[] = [];

  try {
    let currentNodeId: string | undefined = workflow.startNode;

    while (currentNodeId) {
      const node = workflow.nodes.find((n) => n.id === currentNodeId);
      if (!node) {
        throw new Error(`Node ${currentNodeId} not found`);
      }

      nodesExecuted.push(currentNodeId);

      const nextNodeId = await executeNode(
        node,
        context,
        collector,
        workflowSpanId,
        workflow
      );
      currentNodeId = nextNodeId;
    }

    collector.endSpan(workflowSpanId, "OK");

    const outputs: Record<string, unknown> = {};
    for (const [nodeId, output] of context.nodeOutputs.entries()) {
      outputs[nodeId] = output;
    }

    return {
      executionId,
      status: "completed",
      outputs,
      executionTime: Date.now() - startTime,
      nodesExecuted,
      spans: collector.getSpans(),
    };
  } catch (error) {
    collector.endSpan(
      workflowSpanId,
      "ERROR",
      error instanceof Error ? error.message : String(error)
    );

    return {
      executionId,
      status: "failed",
      outputs: {},
      error: error instanceof Error ? error.message : String(error),
      executionTime: Date.now() - startTime,
      nodesExecuted,
      spans: collector.getSpans(),
    };
  }
}

async function executeNode(
  node: WorkflowNode,
  context: any,
  collector: TraceCollector,
  parentSpanId: string,
  workflow: WorkflowDefinition
): Promise<string | undefined> {
  const nodeSpanId = collector.startSpan(
    `workflow.node.${node.type}`,
    {
      "node.id": node.id,
      "node.type": node.type,
      ...(node.procedureName && { "node.procedure": node.procedureName }),
    },
    parentSpanId
  );

  try {
    let nextNodeId: string | undefined;

    switch (node.type) {
      case "procedure":
        nextNodeId = await executeProcedureNode(
          node,
          context,
          collector,
          nodeSpanId
        );
        break;
      case "condition":
        nextNodeId = await executeConditionNode(node, context);
        break;
      case "parallel":
        nextNodeId = await executeParallelNode(
          node,
          context,
          collector,
          nodeSpanId,
          workflow
        );
        break;
      default:
        nextNodeId = typeof node.next === "string" ? node.next : node.next?.[0];
    }

    collector.endSpan(nodeSpanId, "OK");
    return nextNodeId;
  } catch (error) {
    collector.endSpan(
      nodeSpanId,
      "ERROR",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

async function executeProcedureNode(
  node: WorkflowNode,
  context: any,
  collector: TraceCollector,
  parentSpanId: string
): Promise<string | undefined> {
  if (!node.procedureName) {
    throw new Error(`Procedure node ${node.id} missing procedureName`);
  }

  const procedure = mockProcedures[node.procedureName];
  if (!procedure) {
    throw new Error(`Procedure ${node.procedureName} not found`);
  }

  const procSpanId = collector.startSpan(
    `procedure.${node.procedureName}`,
    {
      "procedure.name": node.procedureName,
    },
    parentSpanId
  );

  try {
    const input = { ...node.config, ...context.variables };
    collector.addEvent(procSpanId, "procedure.input", { input });

    const output = await procedure(input);

    collector.addEvent(procSpanId, "procedure.output", { output });
    collector.endSpan(procSpanId, "OK");

    context.nodeOutputs.set(node.id, output);
    Object.assign(context.variables, output);

    return typeof node.next === "string" ? node.next : node.next?.[0];
  } catch (error) {
    collector.endSpan(
      procSpanId,
      "ERROR",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

async function executeConditionNode(
  node: WorkflowNode,
  context: any
): Promise<string | undefined> {
  const config = node.config as any;
  if (!config?.expression) {
    throw new Error(`Condition node ${node.id} missing expression`);
  }

  const result = evaluateExpression(config.expression, context.variables);
  return result ? config.trueBranch : config.falseBranch;
}

async function executeParallelNode(
  node: WorkflowNode,
  context: any,
  collector: TraceCollector,
  parentSpanId: string,
  workflow: WorkflowDefinition
): Promise<string | undefined> {
  const config = node.config as any;
  if (!config?.branches || config.branches.length === 0) {
    throw new Error(`Parallel node ${node.id} missing branches`);
  }

  const branchPromises = config.branches.map(async (branchNodeId: string) => {
    const branchNode = workflow.nodes.find((n) => n.id === branchNodeId);
    if (!branchNode) {
      throw new Error(`Branch node ${branchNodeId} not found`);
    }
    return executeNode(branchNode, context, collector, parentSpanId, workflow);
  });

  if (config.waitForAll) {
    await Promise.all(branchPromises);
  } else {
    await Promise.race(branchPromises);
  }

  return typeof node.next === "string" ? node.next : node.next?.[0];
}

function evaluateExpression(
  expression: string,
  variables: Record<string, unknown>
): boolean {
  try {
    const func = new Function(...Object.keys(variables), `return ${expression}`);
    return func(...Object.values(variables));
  } catch {
    return false;
  }
}
