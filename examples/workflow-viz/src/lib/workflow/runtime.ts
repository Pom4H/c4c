/**
 * Workflow runtime adapter for Next.js example
 * 
 * This uses the framework's core workflow runtime with mock procedures
 */

import { createMockRegistry } from "./mock-registry";
import { SpanCollector, bindCollector, forceFlush, clearActiveCollector } from "@tsdev/workflow";
import type { WorkflowDefinition, WorkflowExecutionResult } from "@tsdev/workflow";

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
  // Bind OTEL exporter to our collector and ensure provider is installed
  await bindCollector(collector);

  try {
    // Dynamically import core after installing provider so tracer binds correctly
    const { executeWorkflow: coreExecuteWorkflow } = await import("@tsdev/workflow");
    // Execute using framework core runtime
    const result = await coreExecuteWorkflow(workflow, mockRegistry, initialInput);
    // Ensure all spans are flushed
    await forceFlush();
    clearActiveCollector();
    
    // Add collected spans for UI visualization
    return {
      ...result,
      spans: collector.getSpans(),
    } as WorkflowExecutionResult & { spans: NonNullable<WorkflowExecutionResult['spans']> };
  } catch (error) {
    await forceFlush();
    clearActiveCollector();
    throw error;
  }
}
