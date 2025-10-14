/**
 * Workflow runtime adapter for Next.js example
 * 
 * This uses the framework's core workflow runtime with mock procedures
 */

import { executeWorkflow as coreExecuteWorkflow } from "@tsdev/workflow";
import { createMockRegistry } from "./mock-registry";
import { SpanCollector } from "./span-collector";
import type { WorkflowDefinition, WorkflowExecutionResult } from "./types";

// Create singleton mock registry
const mockRegistry = createMockRegistry();

/**
 * Execute workflow using framework runtime with mock procedures
 * 
 * This is a thin wrapper that:
 * 1. Uses the framework's core runtime
 * 2. Provides mock procedures for demo
 * 3. Collects trace spans for UI visualization
 */
export async function executeWorkflow(
  workflow: WorkflowDefinition,
  initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
  const collector = new SpanCollector();
  
  // Create workflow span
  const workflowSpanId = collector.startSpan("workflow.execute", {
    "workflow.id": workflow.id,
    "workflow.name": workflow.name,
  });

  try {
    // Execute using framework core runtime
    const result = await coreExecuteWorkflow(workflow, mockRegistry, initialInput);
    
    collector.endSpan(workflowSpanId, result.status === "completed" ? "OK" : "ERROR");
    
    // Add collected spans for UI visualization
    return {
      ...result,
      error: result.error ? (result.error instanceof Error ? result.error.message : String(result.error)) : undefined,
      spans: collector.getSpans(),
    };
  } catch (error) {
    collector.endSpan(
      workflowSpanId,
      "ERROR",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}
