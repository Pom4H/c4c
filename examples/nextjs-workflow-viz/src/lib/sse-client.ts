/**
 * SSE Client for Workflow Execution
 * Replaces Server Actions with real-time streaming updates
 */

import type { WorkflowDefinition, WorkflowExecutionResult } from "./workflow/types";

export interface SSEEvent {
  type: string;
  executionId: string;
  timestamp: string;
  [key: string]: any;
}

export interface WorkflowSSEClient {
  executeWorkflow(
    workflow: WorkflowDefinition,
    input?: Record<string, unknown>,
    onUpdate?: (event: SSEEvent) => void
  ): Promise<WorkflowExecutionResult>;
  
  executeProcedure(
    procedureName: string,
    input: Record<string, unknown>,
    onUpdate?: (event: SSEEvent) => void
  ): Promise<any>;
}

/**
 * Create SSE client for workflow execution
 */
export function createWorkflowSSEClient(baseUrl: string = "http://localhost:3001"): WorkflowSSEClient {
  return {
    async executeWorkflow(
      workflow: WorkflowDefinition,
      input?: Record<string, unknown>,
      onUpdate?: (event: SSEEvent) => void
    ): Promise<WorkflowExecutionResult> {
      return new Promise((resolve, reject) => {
        const eventSource = new EventSource(`${baseUrl}/workflow/execute-sse`, {
          // Note: EventSource doesn't support POST, so we'll use fetch with ReadableStream
        });

        // Use fetch with ReadableStream for POST request
        fetch(`${baseUrl}/workflow/execute-sse`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ workflow, input }),
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error("No response body");
            }

            const decoder = new TextDecoder();
            let result: WorkflowExecutionResult | null = null;

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const eventData = JSON.parse(line.slice(6));
                      
                      // Call update callback
                      if (onUpdate) {
                        onUpdate(eventData);
                      }

                      // Check if this is the final result
                      if (eventData.type === "workflow_completed") {
                        result = eventData.result;
                      } else if (eventData.type === "workflow_error") {
                        reject(new Error(eventData.error));
                        return;
                      }
                    } catch (parseError) {
                      console.warn("Failed to parse SSE event:", parseError);
                    }
                  }
                }
              }

              if (result) {
                resolve(result);
              } else {
                reject(new Error("Workflow execution did not complete"));
              }
            } finally {
              reader.releaseLock();
            }
          })
          .catch(reject);
      });
    },

    async executeProcedure(
      procedureName: string,
      input: Record<string, unknown>,
      onUpdate?: (event: SSEEvent) => void
    ): Promise<any> {
      return new Promise((resolve, reject) => {
        fetch(`${baseUrl}/procedure/execute-sse/${procedureName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error("No response body");
            }

            const decoder = new TextDecoder();
            let result: any = null;

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const eventData = JSON.parse(line.slice(6));
                      
                      // Call update callback
                      if (onUpdate) {
                        onUpdate(eventData);
                      }

                      // Check if this is the final result
                      if (eventData.type === "procedure_completed") {
                        result = eventData.result;
                      } else if (eventData.type === "procedure_error") {
                        reject(new Error(eventData.error));
                        return;
                      }
                    } catch (parseError) {
                      console.warn("Failed to parse SSE event:", parseError);
                    }
                  }
                }
              }

              if (result !== null) {
                resolve(result);
              } else {
                reject(new Error("Procedure execution did not complete"));
              }
            } finally {
              reader.releaseLock();
            }
          })
          .catch(reject);
      });
    },
  };
}

/**
 * Hook for using SSE client in React components
 */
export function useWorkflowSSE(baseUrl?: string) {
  const client = createWorkflowSSEClient(baseUrl);
  
  return {
    executeWorkflow: client.executeWorkflow,
    executeProcedure: client.executeProcedure,
  };
}