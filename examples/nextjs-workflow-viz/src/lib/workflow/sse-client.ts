/**
 * SSE Client for workflow execution
 */

import type { WorkflowExecutionResult } from "./types";

export type WorkflowSSEEvent =
  | { type: "start"; workflowId: string; workflowName: string; timestamp: number }
  | { type: "node-executed"; nodeId: string; timestamp: number }
  | { type: "complete"; result: WorkflowExecutionResult; timestamp: number }
  | { type: "error"; error: string; timestamp: number };

export interface WorkflowSSECallbacks {
  onStart?: (event: Extract<WorkflowSSEEvent, { type: "start" }>) => void;
  onProgress?: (event: Extract<WorkflowSSEEvent, { type: "node-executed" }>) => void;
  onComplete?: (event: Extract<WorkflowSSEEvent, { type: "complete" }>) => void;
  onError?: (event: Extract<WorkflowSSEEvent, { type: "error" }>) => void;
}

/**
 * Execute workflow via SSE
 */
export async function executeWorkflowSSE(
  workflowId: string,
  input: Record<string, unknown> | undefined,
  callbacks: WorkflowSSECallbacks
): Promise<void> {
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(
      `/api/workflows/${workflowId}/execute`,
      { withCredentials: false }
    );

    // We need to POST the input, but EventSource doesn't support POST
    // So we'll use fetch with SSE instead
    eventSource.close();

    fetch(`/api/workflows/${workflowId}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
    }).then(async (response) => {
      if (!response.ok) {
        reject(new Error(`HTTP error! status: ${response.status}`));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        reject(new Error("No response body"));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            resolve();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            const eventMatch = line.match(/^event: (.+)$/m);
            const dataMatch = line.match(/^data: (.+)$/m);

            if (eventMatch && dataMatch) {
              const eventType = eventMatch[1];
              const data = JSON.parse(dataMatch[1]) as WorkflowSSEEvent;

              switch (eventType) {
                case "workflow-start":
                  if (data.type === "start" && callbacks.onStart) {
                    callbacks.onStart(data);
                  }
                  break;
                case "workflow-progress":
                  if (data.type === "node-executed" && callbacks.onProgress) {
                    callbacks.onProgress(data);
                  }
                  break;
                case "workflow-complete":
                  if (data.type === "complete" && callbacks.onComplete) {
                    callbacks.onComplete(data);
                  }
                  break;
                case "workflow-error":
                  if (data.type === "error" && callbacks.onError) {
                    callbacks.onError(data);
                    reject(new Error(data.error));
                  }
                  break;
              }
            }
          }
        }
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

/**
 * Fetch available workflows
 */
export async function fetchWorkflows() {
  const response = await fetch("/api/workflows");
  if (!response.ok) {
    throw new Error(`Failed to fetch workflows: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch workflow definition
 */
export async function fetchWorkflowDefinition(workflowId: string) {
  const response = await fetch(`/api/workflows/${workflowId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch workflow: ${response.statusText}`);
  }
  return response.json();
}
