import type { WorkflowResumeState, WorkflowExecutionResult } from "./types.js";

export type SerializedWorkflowExecutionResult = Omit<WorkflowExecutionResult, "error"> & {
  error?: {
    message: string;
    name?: string;
    stack?: string;
  };
};

export type WorkflowEvent =
  | {
      type: "workflow.started";
      workflowId: string;
      executionId: string;
      startTime: number;
    }
  | {
      type: "workflow.resumed";
      workflowId: string;
      executionId: string;
      timestamp: number;
    }
  | {
      type: "workflow.completed";
      workflowId: string;
      executionId: string;
      executionTime: number;
      nodesExecuted: string[];
    }
  | {
      type: "workflow.failed";
      workflowId: string;
      executionId: string;
      executionTime: number;
      nodesExecuted: string[];
      error: string;
    }
  | {
      type: "workflow.paused";
      workflowId: string;
      executionId: string;
      executionTime: number;
      nodesExecuted: string[];
      resumeState: WorkflowResumeState;
    }
  | {
      type: "node.started";
      workflowId: string;
      executionId: string;
      nodeId: string;
      nodeIndex?: number;
      timestamp: number;
    }
  | {
      type: "node.completed";
      workflowId: string;
      executionId: string;
      nodeId: string;
      nodeIndex?: number;
      nextNodeId?: string;
      timestamp: number;
    }
  | {
      type: "workflow.result";
      workflowId: string;
      executionId: string;
      result: SerializedWorkflowExecutionResult;
    };

type Listener = (event: WorkflowEvent) => void;

const executionIdToListeners = new Map<string, Set<Listener>>();

export function subscribeToExecution(
  executionId: string,
  listener: Listener
): () => void {
  let set = executionIdToListeners.get(executionId);
  if (!set) {
    set = new Set();
    executionIdToListeners.set(executionId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) {
      executionIdToListeners.delete(executionId);
    }
  };
}

export function publish(event: WorkflowEvent): void {
  const listeners = executionIdToListeners.get(event.executionId);
  if (!listeners) return;
  for (const listener of Array.from(listeners)) {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  }
  if (
    event.type === "workflow.completed" ||
    event.type === "workflow.failed" ||
    event.type === "workflow.paused"
  ) {
    executionIdToListeners.delete(event.executionId);
  }
}
