/**
 * Workflow types for Next.js example
 */

export interface WorkflowNode {
  id: string;
  type: "procedure" | "condition" | "parallel" | "sequential";
  procedureName?: string;
  config?: Record<string, unknown>;
  next?: string | string[];
  onError?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: WorkflowNode[];
  startNode: string;
  variables?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface WorkflowExecutionResult {
  executionId: string;
  status: "completed" | "failed" | "cancelled";
  outputs: Record<string, unknown>;
  error?: string;
  executionTime: number;
  nodesExecuted: string[];
  spans: TraceSpan[];
}

/**
 * OpenTelemetry span representation for visualization
 */
export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: {
    code: "OK" | "ERROR" | "UNSET";
    message?: string;
  };
  attributes: Record<string, string | number | boolean>;
  events?: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, unknown>;
  }>;
}

/**
 * Workflow execution state for real-time visualization
 */
export interface WorkflowExecutionState {
  executionId: string;
  status: "running" | "completed" | "failed";
  currentNode?: string;
  nodesExecuted: string[];
  nodeStates: Record<string, {
    status: "pending" | "running" | "completed" | "failed";
    startTime?: number;
    endTime?: number;
    output?: unknown;
    error?: string;
  }>;
  spans: TraceSpan[];
}
