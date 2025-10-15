import { SpanCollector, bindCollector, clearActiveCollector, forceFlush, executeWorkflow as coreExecuteWorkflow, type WorkflowDefinition, type WorkflowExecutionResult } from '@tsdev/workflow';
import { collectRegistryFromPaths } from '@tsdev/core';

/** Execute a workflow using example mock registry (for dashboard demo) */
export async function executeWorkflow(workflow: WorkflowDefinition, initialInput: Record<string, unknown> = {}, options?: { executionId?: string }): Promise<WorkflowExecutionResult> {
  const registry = await collectRegistryFromPaths(['examples/basic/src/handlers']);
  const collector = new SpanCollector();
  await bindCollector(collector);
  try {
    const result = await coreExecuteWorkflow(workflow, registry, initialInput, options);
    await forceFlush();
    clearActiveCollector();
    return { ...result, spans: collector.getSpans() } as WorkflowExecutionResult;
  } catch (err) {
    await forceFlush();
    clearActiveCollector();
    throw err;
  }
}
