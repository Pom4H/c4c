import { describe, it, expect, beforeEach } from 'vitest';
import { workflow, step, when, condition, type Registry } from '@c4c/workflow';
import { executeWorkflow, resumeWorkflow } from '@c4c/workflow';
import { z } from 'zod';

/**
 * Unit tests for pausable workflows with when() helper
 * 
 * Tests:
 * - Workflow pauses at when() node
 * - WorkflowPauseState is created correctly
 * - Workflow resumes from pause point
 * - Context and variables are preserved
 * - Multiple pause points work correctly
 * - Condition with switch-case works
 */

// Create a minimal mock registry for testing
function createMockRegistry(): Registry {
  const procedures = new Map();
  
  return {
    procedures,
    register: (procedure: any) => {
      procedures.set(procedure.contract.name, procedure);
    },
    get: (name: string) => procedures.get(name),
    has: (name: string) => procedures.has(name),
    list: () => Array.from(procedures.values()),
    emit: () => {},
  } as any as Registry;
}

describe('Pausable Workflow Tests', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = createMockRegistry();
    
    // Register all mock procedures needed for tests
    registry.register({
      contract: {
        name: 'test.start',
        input: z.object({ orderId: z.string() }),
        output: z.object({ orderId: z.string(), total: z.number() }),
      },
      handler: async (input: any) => ({ orderId: input.orderId, total: 100 }),
    });

    registry.register({
      contract: {
        name: 'test.complete',
        input: z.object({ approved: z.boolean() }),
        output: z.object({ success: z.boolean() }),
      },
      handler: async (input: any) => ({ success: input.approved }),
    });

    registry.register({
      contract: {
        name: 'test.double',
        input: z.object({ value: z.number() }),
        output: z.object({ doubled: z.number() }),
      },
      handler: async (input: any) => ({ doubled: input.value * 2 }),
    });

    registry.register({
      contract: {
        name: 'test.sum',
        input: z.object({ doubled: z.number(), extra: z.number() }),
        output: z.object({ sum: z.number() }),
      },
      handler: async (input: any) => ({ sum: input.doubled + input.extra }),
    });

    registry.register({
      contract: {
        name: 'test.init',
        input: z.object({ id: z.string() }),
        output: z.object({ id: z.string(), stage: z.string() }),
      },
      handler: async (input: any) => ({ id: input.id, stage: 'initialized' }),
    });

    registry.register({
      contract: {
        name: 'test.afterCheckpoint1',
        input: z.object({ checkpoint1: z.string() }),
        output: z.object({ stage: z.string() }),
      },
      handler: async () => ({ stage: 'checkpoint1-passed' }),
    });

    registry.register({
      contract: {
        name: 'test.afterCheckpoint2',
        input: z.object({ checkpoint2: z.string() }),
        output: z.object({ completed: z.boolean() }),
      },
      handler: async () => ({ completed: true }),
    });

    registry.register({
      contract: {
        name: 'test.identity',
        input: z.any(),
        output: z.any(),
      },
      handler: async (input: any) => input,
    });

    registry.register({
      contract: {
        name: 'test.checkDone',
        input: z.object({ status: z.string() }),
        output: z.object({ done: z.boolean() }),
      },
      handler: async (input: any) => ({ done: input.status === 'completed' }),
    });

    registry.register({
      contract: {
        name: 'test.calculateRisk',
        input: z.object({ orderId: z.string() }),
        output: z.object({ riskLevel: z.enum(['low', 'medium', 'high', 'critical']) }),
      },
      handler: async () => ({ riskLevel: 'high' as const }),
    });

    registry.register({
      contract: {
        name: 'test.processLow',
        input: z.any(),
        output: z.object({ result: z.string() }),
      },
      handler: async () => ({ result: 'processed-immediately' }),
    });

    registry.register({
      contract: {
        name: 'test.reject',
        input: z.any(),
        output: z.object({ result: z.string() }),
      },
      handler: async () => ({ result: 'rejected' }),
    });

    registry.register({
      contract: {
        name: 'test.final',
        input: z.any(),
        output: z.object({ completed: z.boolean() }),
      },
      handler: async () => ({ completed: true }),
    });

    registry.register({
      contract: {
        name: 'test.add10',
        input: z.object({ value: z.number() }),
        output: z.object({ result: z.number() }),
      },
      handler: async (input: any) => ({ result: input.value + 10 }),
    });
  });

  describe('Basic Pause/Resume', () => {
    it('should pause workflow at when() node', async () => {
      const startStep = step({
        id: 'start',
        input: z.object({ orderId: z.string() }),
        output: z.object({ orderId: z.string(), total: z.number() }),
        execute: ({ engine, inputData }) => 
          engine.run('test.start', { orderId: inputData.orderId }),
      });

      const awaitApproval = when({
        id: 'await-approval',
        on: 'approval.trigger.approved',
        output: z.object({ approved: z.boolean() }),
      });

      const completeStep = step({
        id: 'complete',
        input: z.object({ approved: z.boolean() }),
        output: z.object({ success: z.boolean() }),
        execute: ({ engine, inputData }) => 
          engine.run('test.complete', { approved: inputData.approved }),
      });

      const testWorkflow = workflow('test-pause')
        .step(startStep)
        .step(awaitApproval)
        .step(completeStep)
        .commit();

      // Execute workflow
      const result = await executeWorkflow(testWorkflow, registry, { orderId: 'order-123' });

      // Should pause at await-approval node
      expect(result.status).toBe('paused');
      expect(result.nodesExecuted).toContain('start');
      expect(result.nodesExecuted).not.toContain('complete');
      
      // Check pause state
      expect(result.resumeState).toBeDefined();
      const pauseState = result.resumeState!;
      
      expect(pauseState.pausedAt).toBe('await-approval');
      expect(pauseState.waitingFor).toBeDefined();
      expect(pauseState.waitingFor?.procedures).toContain('approval.trigger.approved');
      expect(pauseState.variables.orderId).toBe('order-123');
    });

    it('should resume workflow from pause point', async () => {
      const startStep = step({
        id: 'start',
        input: z.object({ orderId: z.string() }),
        output: z.object({ orderId: z.string(), total: z.number() }),
        execute: ({ engine, inputData }) => 
          engine.run('test.start', { orderId: inputData.orderId }),
      });

      const awaitApproval = when({
        id: 'await-approval',
        on: 'approval.trigger.approved',
        output: z.object({ approved: z.boolean() }),
      });

      const completeStep = step({
        id: 'complete',
        input: z.object({ approved: z.boolean() }),
        output: z.object({ success: z.boolean() }),
        execute: ({ engine, inputData }) => 
          engine.run('test.complete', { approved: inputData.approved }),
      });

      const testWorkflow = workflow('test-resume')
        .step(startStep)
        .step(awaitApproval)
        .step(completeStep)
        .commit();

      // Execute workflow - should pause
      const pausedResult = await executeWorkflow(testWorkflow, registry, { orderId: 'order-456' });
      expect(pausedResult.status).toBe('paused');

      // Resume workflow with approval data
      const resumeData = { approved: true };
      const resumedResult = await resumeWorkflow(
        testWorkflow,
        registry,
        pausedResult.resumeState!,
        resumeData
      );

      // Should complete successfully
      expect(resumedResult.status).toBe('completed');
      expect(resumedResult.nodesExecuted).toContain('start');
      expect(resumedResult.nodesExecuted).toContain('await-approval');
      expect(resumedResult.nodesExecuted).toContain('complete');
      expect(resumedResult.outputs.success).toBe(true);
    });

    it('should preserve context variables across pause/resume', async () => {
      const step1 = step({
        id: 'step1',
        input: z.object({ value: z.number() }),
        output: z.object({ doubled: z.number() }),
        execute: ({ engine, inputData }) => 
          engine.run('test.double', { value: inputData.value }),
      });

      const awaitContinue = when({
        id: 'await-continue',
        on: 'continue.trigger',
        output: z.object({ extra: z.number() }),
      });

      const step2 = step({
        id: 'step2',
        input: z.object({ doubled: z.number(), extra: z.number() }),
        output: z.object({ sum: z.number() }),
        execute: ({ engine, inputData }) => 
          engine.run('test.sum', { doubled: inputData.doubled, extra: inputData.extra }),
      });

      const testWorkflow = workflow('test-context')
        .step(step1)
        .step(awaitContinue)
        .step(step2)
        .commit();

      // Execute - should pause
      const pausedResult = await executeWorkflow(testWorkflow, registry, { value: 5 });
      expect(pausedResult.status).toBe('paused');

      // Check that doubled value is preserved
      expect(pausedResult.resumeState?.variables).toHaveProperty('doubled', 10);

      // Resume with extra data
      const resumedResult = await resumeWorkflow(
        testWorkflow,
        registry,
        pausedResult.resumeState!,
        { extra: 3 }
      );

      expect(resumedResult.status).toBe('completed');
      expect(resumedResult.outputs.sum).toBe(13); // 10 + 3
    });
  });

  describe('Multiple Pause Points', () => {
    it('should handle multiple pause points in sequence', async () => {
      const step1 = step({
        id: 'step1',
        input: z.object({ id: z.string() }),
        output: z.object({ id: z.string(), stage: z.string() }),
        execute: ({ engine, inputData }) => 
          engine.run('test.init', { id: inputData.id }),
      });

      const pause1 = when({
        id: 'pause1',
        on: 'checkpoint1.trigger',
        output: z.object({ checkpoint1: z.string() }),
      });

      const step2 = step({
        id: 'step2',
        input: z.object({ checkpoint1: z.string() }),
        output: z.object({ stage: z.string() }),
        execute: ({ engine, inputData }) => 
          engine.run('test.afterCheckpoint1', { checkpoint1: inputData.checkpoint1 }),
      });

      const pause2 = when({
        id: 'pause2',
        on: 'checkpoint2.trigger',
        output: z.object({ checkpoint2: z.string() }),
      });

      const step3 = step({
        id: 'step3',
        input: z.object({ checkpoint2: z.string() }),
        output: z.object({ completed: z.boolean() }),
        execute: ({ engine, inputData }) => 
          engine.run('test.afterCheckpoint2', { checkpoint2: inputData.checkpoint2 }),
      });

      const testWorkflow = workflow('test-multiple-pauses')
        .step(step1)
        .step(pause1)
        .step(step2)
        .step(pause2)
        .step(step3)
        .commit();

      // First execution - pause at pause1
      const result1 = await executeWorkflow(testWorkflow, registry, { id: 'test-123' });
      expect(result1.status).toBe('paused');
      expect(result1.resumeState?.pausedAt).toBe('pause1');

      // Resume - should pause at pause2
      const result2 = await resumeWorkflow(
        testWorkflow,
        registry,
        result1.resumeState!,
        { checkpoint1: 'passed' }
      );
      expect(result2.status).toBe('paused');
      expect(result2.resumeState?.pausedAt).toBe('pause2');

      // Resume again - should complete
      const result3 = await resumeWorkflow(
        testWorkflow,
        registry,
        result2.resumeState!,
        { checkpoint2: 'passed' }
      );
      expect(result3.status).toBe('completed');
      expect(result3.outputs.completed).toBe(true);
    });
  });

  describe('Pause with Filters', () => {
    it('should use filter function to match trigger data', async () => {
      const startStep = step({
        id: 'start',
        input: z.object({ orderId: z.string() }),
        output: z.object({ orderId: z.string() }),
        execute: ({ engine, inputData }) => 
          engine.run('test.identity', inputData),
      });

      const awaitForSpecificOrder = when({
        id: 'await-specific',
        on: 'order.trigger.updated',
        filter: (event, context) => {
          // Only resume if the trigger is for our specific order
          return (event as any).orderId === context.variables.orderId;
        },
        output: z.object({ status: z.string() }),
      });

      const finalStep = step({
        id: 'final',
        input: z.object({ status: z.string() }),
        output: z.object({ done: z.boolean() }),
        execute: ({ engine, inputData }) => 
          engine.run('test.checkDone', { status: inputData.status }),
      });

      const testWorkflow = workflow('test-filter')
        .step(startStep)
        .step(awaitForSpecificOrder)
        .step(finalStep)
        .commit();

      const result = await executeWorkflow(testWorkflow, registry, { orderId: 'order-789' });
      
      expect(result.status).toBe('paused');
      expect(result.resumeState?.waitingFor?.filter).toBeDefined();
      
      // The filter function should be stored for later matching
      const filter = result.resumeState?.waitingFor?.filter;
      expect(filter).toBeInstanceOf(Function);
      
      // Simulate matching - correct orderId
      const shouldResume = filter!(
        { orderId: 'order-789', status: 'completed' },
        result.resumeState!
      );
      expect(shouldResume).toBe(true);
      
      // Simulate non-matching - wrong orderId
      const shouldNotResume = filter!(
        { orderId: 'order-999', status: 'completed' },
        result.resumeState!
      );
      expect(shouldNotResume).toBe(false);
    });
  });

  describe('Condition with Switch-Case', () => {
    it('should route to different branches based on switch value', async () => {
      const calculateRisk = step({
        id: 'calculate-risk',
        input: z.object({ orderId: z.string() }),
        output: z.object({ riskLevel: z.enum(['low', 'medium', 'high', 'critical']) }),
        execute: ({ engine, inputData }) => 
          engine.run('test.calculateRisk', { orderId: inputData.orderId }),
      });

      const processLowRisk = step({
        id: 'process-low',
        input: z.any(),
        output: z.object({ result: z.string() }),
        execute: ({ engine }) => engine.run('test.processLow', {}),
      });

      const awaitApproval = when({
        id: 'await-approval',
        on: 'approval.trigger',
        output: z.object({ approved: z.boolean() }),
      });

      const rejectOrder = step({
        id: 'reject',
        input: z.any(),
        output: z.object({ result: z.string() }),
        execute: ({ engine }) => engine.run('test.reject', {}),
      });

      const routeByRisk = condition({
        id: 'route-by-risk',
        input: z.object({ riskLevel: z.string() }),
        switch: ({ inputData }) => inputData.riskLevel,
        cases: {
          'low': processLowRisk,
          'medium': processLowRisk,
          'high': awaitApproval,
          'critical': rejectOrder,
        },
        default: awaitApproval,
      });

      const finalStep = step({
        id: 'final',
        input: z.any(),
        output: z.object({ completed: z.boolean() }),
        execute: ({ engine }) => engine.run('test.final', {}),
      });

      const testWorkflow = workflow('test-switch')
        .step(calculateRisk)
        .step(routeByRisk)
        .step(finalStep)
        .commit();

      // Execute - should route to high risk (await approval)
      const result = await executeWorkflow(testWorkflow, registry, { orderId: 'order-high-risk' });
      
      expect(result.status).toBe('paused');
      expect(result.resumeState?.pausedAt).toBe('await-approval');
      
      // Resume with approval
      const resumedResult = await resumeWorkflow(
        testWorkflow,
        registry,
        result.resumeState!,
        { approved: true }
      );
      
      expect(resumedResult.status).toBe('completed');
      expect(resumedResult.nodesExecuted).toContain('final');
    });
  });

  describe('Timeout Handling', () => {
    it('should include timeout information in pause state', async () => {
      const startStep = step({
        id: 'start',
        input: z.object({ id: z.string() }),
        output: z.object({ id: z.string() }),
        execute: ({ engine, inputData }) => engine.run('test.identity', inputData),
      });

      const awaitWithTimeout = when({
        id: 'await-timeout',
        on: 'action.trigger',
        timeout: {
          duration: 60000, // 1 minute
          onTimeout: 'timeout-handler',
        },
        output: z.object({ action: z.string() }),
      });

      const completeStep = step({
        id: 'complete',
        input: z.any(),
        output: z.object({ done: z.boolean() }),
        execute: ({ engine }) => engine.run('test.final', {}),
      });

      const testWorkflow = workflow('test-timeout')
        .step(startStep)
        .step(awaitWithTimeout)
        .step(completeStep)
        .commit();

      const result = await executeWorkflow(testWorkflow, registry, { id: 'test-timeout' });
      
      expect(result.status).toBe('paused');
      expect(result.resumeState?.timeoutAt).toBeDefined();
      
      // Timeout should be approximately 1 minute from now
      const timeoutAt = new Date(result.resumeState!.timeoutAt!).getTime();
      const now = Date.now();
      const diff = timeoutAt - now;
      
      expect(diff).toBeGreaterThan(50000); // At least 50 seconds
      expect(diff).toBeLessThan(70000); // At most 70 seconds (accounting for test execution time)
    });
  });

  describe('Error Cases', () => {
    it('should handle workflow with no await nodes normally', async () => {
      const step1 = step({
        id: 'step1',
        input: z.object({ value: z.number() }),
        output: z.object({ doubled: z.number() }),
        execute: ({ engine, inputData }) => engine.run('test.double', { value: inputData.value }),
      });

      const step2 = step({
        id: 'step2',
        input: z.object({ doubled: z.number() }),
        output: z.object({ result: z.number() }),
        execute: ({ engine, inputData }) => engine.run('test.add10', { value: inputData.doubled }),
      });

      const testWorkflow = workflow('test-no-pause')
        .step(step1)
        .step(step2)
        .commit();

      const result = await executeWorkflow(testWorkflow, registry, { value: 5 });
      
      // Should complete without pausing
      expect(result.status).toBe('completed');
      // Outputs collected from final node
      expect(result.nodesExecuted).toContain('step1');
      expect(result.nodesExecuted).toContain('step2');
      expect(result.resumeState).toBeUndefined();
    });

    it('should capture trigger procedures in pause state', async () => {
      const startStep = step({
        id: 'start',
        input: z.object({ id: z.string() }),
        output: z.object({ id: z.string() }),
        execute: ({ engine, inputData }) => engine.run('test.identity', inputData),
      });

      const awaitSpecific = when({
        id: 'await-specific',
        on: 'specific.trigger',
        output: z.object({ data: z.string() }),
      });

      const endStep = step({
        id: 'end',
        input: z.any(),
        output: z.object({ done: z.boolean() }),
        execute: ({ engine }) => engine.run('test.final', {}),
      });

      const testWorkflow = workflow('test-wrong-trigger')
        .step(startStep)
        .step(awaitSpecific)
        .step(endStep)
        .commit();

      const pausedResult = await executeWorkflow(testWorkflow, registry, { id: 'test' });
      expect(pausedResult.status).toBe('paused');

      // Verify pause state contains correct trigger info
      expect(pausedResult.resumeState?.waitingFor?.procedures).toContain('specific.trigger');
      expect(pausedResult.resumeState?.waitingFor?.procedures).not.toContain('wrong.trigger');
    });
  });
});
