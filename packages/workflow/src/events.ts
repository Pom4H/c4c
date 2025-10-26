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
      resumedFrom: string;
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
      pausedAt: string;
      waitingFor: string[];
      executionTime: number;
      nodesExecuted?: string[];
      resumeState?: WorkflowResumeState;
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
      output?: unknown;
    }
  | {
      type: "workflow.result";
      workflowId: string;
      executionId: string;
      result: SerializedWorkflowExecutionResult;
    };

type Listener = (event: WorkflowEvent) => void;

const executionIdToListeners = new Map<string, Set<Listener>>();
const globalListeners = new Set<Listener>();

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

export function subscribeToAllExecutions(listener: Listener): () => void {
  globalListeners.add(listener);
  return () => {
    globalListeners.delete(listener);
  };
}

export function publish(event: WorkflowEvent): void {
  // Notify execution-specific listeners
  const listeners = executionIdToListeners.get(event.executionId);
  if (listeners) {
    for (const listener of Array.from(listeners)) {
      try {
        listener(event);
      } catch {
        // ignore listener errors
      }
    }
  }
  
  // Notify global listeners
  for (const listener of Array.from(globalListeners)) {
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
