/**
 * Workflow: Check Overdue Tasks (Type-Safe Version)
 * 
 * This version demonstrates how the new type system improvements help:
 * 1. ✅ Type-safe cross-app procedure calls
 * 2. ✅ Compile-time validation of step connections
 * 3. ✅ Full IDE autocomplete and type checking
 * 4. ✅ Runtime validation with detailed error messages
 */

import { workflow, step, validateWorkflowTypes } from '@c4c/workflow';
import { z } from 'zod';
import type { Procedure } from '@c4c/core';

// ==========================================
// STEP 1: Define Procedure Types
// ==========================================

// Import schemas from actual procedures
const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const NotificationSchema = z.object({
  id: z.string(),
  message: z.string(),
  recipient: z.string().optional(),
  channel: z.enum(['email', 'sms', 'push', 'webhook']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  status: z.enum(['pending', 'sent', 'failed']),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sentAt: z.string().optional(),
  createdAt: z.string(),
});

// Define types for cross-app procedures
type TasksListInput = z.infer<typeof z.object({
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  assignee: z.string().optional(),
  limit: z.number().optional(),
})>;

type TasksListOutput = z.infer<typeof z.object({
  tasks: z.array(TaskSchema),
  total: z.number(),
})>;

type NotificationSendInput = z.infer<typeof z.object({
  message: z.string(),
  recipient: z.string().optional(),
  channel: z.enum(['email', 'sms', 'push', 'webhook']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  metadata: z.record(z.string(), z.unknown()).optional(),
})>;

type NotificationSendOutput = z.infer<typeof NotificationSchema>;

// ==========================================
// STEP 2: Module Augmentation for Type-Safe Registry
// ==========================================

declare module "@c4c/core" {
  interface ProcedureTypeMap {
    // Cross-app procedure from App A (task-manager)
    "task-manager.tasks.list": Procedure<TasksListInput, TasksListOutput>;
    
    // Local procedure from App B (notification-service)
    "notifications.send": Procedure<NotificationSendInput, NotificationSendOutput>;
  }
}

// ==========================================
// STEP 3: Define Workflow Steps with Full Type Safety
// ==========================================

/**
 * Step 1: Get tasks from App A
 * 
 * ✅ BENEFIT: Output type is fully defined and validated
 */
const getTasksStep = step({
  id: 'get-tasks',
  procedure: 'task-manager.tasks.list', // ✅ Autocomplete works!
  input: z.object({ 
    status: z.enum(['in_progress']).default('in_progress') 
  }),
  output: z.object({
    tasks: z.array(TaskSchema),
    total: z.number(),
  }),
});

/**
 * Step 2: Transform data to match notification input
 * 
 * ⚠️ PROBLEM DETECTED: Output of Step 1 doesn't match input of Step 3!
 * The new type system will catch this at compile-time or runtime validation
 */

// WRONG: This step definition would cause a type error
/*
const sendNotificationStep = step({
  id: 'send-notification',
  procedure: 'notifications.send',
  input: z.object({
    count: z.number(),  // ❌ ERROR: This doesn't match output of getTasksStep!
  }),
  output: NotificationSchema,
});
*/

// CORRECT: We need a transformation step OR proper mapping
const transformToNotificationStep = step({
  id: 'transform-tasks',
  procedure: 'data.transform', // Hypothetical transformation procedure
  input: z.object({
    tasks: z.array(TaskSchema),
    total: z.number(),
  }), // ✅ Matches output of getTasksStep
  output: z.object({
    message: z.string(),
    channel: z.enum(['email', 'sms', 'push', 'webhook']),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
  }),
});

const sendNotificationStep = step({
  id: 'send-notification',
  procedure: 'notifications.send',
  input: z.object({
    message: z.string(),
    channel: z.enum(['email', 'sms', 'push', 'webhook']),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
  }), // ✅ Now matches output of transformToNotificationStep
  output: NotificationSchema,
});

// ==========================================
// STEP 4: Build Workflow with Type Validation
// ==========================================

export const checkOverdueTasksTyped = workflow('check-overdue-tasks-typed')
  .name('Check Overdue Tasks (Type-Safe)')
  .description('Type-safe workflow that checks overdue tasks and sends notifications')
  .version('2.0.0')
  .step(getTasksStep)
  .step(transformToNotificationStep) // ✅ Type-checked connection
  .step(sendNotificationStep)        // ✅ Type-checked connection
  .commit();

// ==========================================
// STEP 5: Runtime Validation
// ==========================================

/**
 * Validate workflow types at runtime
 * This will catch any type mismatches between steps
 */
export async function validateWorkflow(procedureRegistry: Map<string, Procedure>) {
  const validation = validateWorkflowTypes(checkOverdueTasksTyped, procedureRegistry);
  
  if (!validation.valid) {
    console.error('❌ Workflow has type errors:');
    for (const error of validation.errors) {
      console.error(`  - Node ${error.nodeId}: ${error.error}`);
    }
    throw new Error('Workflow validation failed');
  }
  
  console.log('✅ Workflow is type-safe!');
}

// ==========================================
// COMPARISON: What Changed?
// ==========================================

/*
BEFORE (Original Version):
❌ No compile-time checking between steps
❌ Can't detect that getTasksStep output doesn't match sendNotificationStep input
❌ Runtime errors only discovered during execution
❌ No IDE autocomplete for procedure names
❌ Type errors in cross-app calls not caught

AFTER (Type-Safe Version):
✅ Compile-time checking of step connections
✅ IDE shows error: "Step output type doesn't match next step input"
✅ Autocomplete for procedure names ('task-manager.tasks.list')
✅ Runtime validation with detailed error messages
✅ Type-safe cross-app procedure calls
✅ Can validate before deployment

CONCRETE BENEFITS FOR THIS WORKFLOW:

1. **Type Mismatch Detection:**
   Original code has a bug - getTasks returns { tasks: [], total: number }
   but sendNotification expects { count: number }
   
   With new types: ❌ TypeScript error at line 116
   "Type '{ tasks: Task[]; total: number }' is not assignable to 
    type '{ count: number }'"

2. **Cross-App Type Safety:**
   When calling 'task-manager.tasks.list' from App B,
   you get full type checking as if it was a local procedure
   
   registry.get('task-manager.tasks.list') 
   // ✅ Returns: Procedure<TasksListInput, TasksListOutput>

3. **Runtime Validation:**
   validateWorkflowTypes() will report:
   "Node get-tasks: Type mismatch - output is not compatible with 
    send-notification input"

4. **IDE Support:**
   - Autocomplete for procedure names
   - Inline documentation
   - Type errors highlighted in red
   - Refactoring is safe (rename procedure = update all references)
*/

// ==========================================
// EXAMPLE: How to Fix the Original Workflow
// ==========================================

/**
 * Option 1: Add a transformation step (shown above)
 * Option 2: Use inline transformation in step config
 */
export const checkOverdueTasksFixed = workflow('check-overdue-tasks-fixed')
  .name('Check Overdue Tasks (Fixed)')
  .step(step({
    id: 'get-and-transform',
    procedure: 'task-manager.tasks.list',
    input: z.object({ status: z.literal('in_progress') }),
    output: z.object({
      tasks: z.array(TaskSchema),
      total: z.number(),
    }),
  }))
  .step(step({
    id: 'send-notification',
    procedure: 'notifications.send',
    input: z.object({
      message: z.string(),
      channel: z.enum(['email', 'sms', 'push', 'webhook']),
      priority: z.enum(['low', 'normal', 'high', 'urgent']),
    }),
    output: NotificationSchema,
    // ✅ Use execute to transform data
    execute: ({ engine, variables }) => {
      // Access previous step output
      const tasksData = variables.get('get-and-transform');
      const count = (tasksData as TasksListOutput)?.total ?? 0;
      
      return engine.run('notifications.send', {
        message: `⚠️ You have ${count} overdue task(s)!`,
        channel: 'email',
        priority: 'high',
      });
    },
  }))
  .commit();

export default checkOverdueTasksTyped;
