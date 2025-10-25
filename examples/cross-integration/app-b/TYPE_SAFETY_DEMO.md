# Type Safety Improvements Demo

## Problem in Original Workflow

The original `check-overdue-tasks.ts` has a **type mismatch bug** that's not caught:

```typescript
// Step 1 output:
{
  tasks: Task[],
  total: number
}

// Step 2 expects:
{
  count: number  // ❌ MISMATCH!
}
```

## How New Type System Helps

### 1. ✅ Compile-Time Detection

**Before:**
```typescript
// No error shown in IDE
const getTasks = step({ output: z.object({ tasks: z.array(...), total: z.number() }) });
const sendNotif = step({ input: z.object({ count: z.number() }) });

workflow().step(getTasks).step(sendNotif); // ❌ Silently wrong
```

**After:**
```typescript
// With new type system:
workflow().step(getTasks).step(sendNotif);
// ❌ TypeScript Error (line XX):
// Argument of type 'Step<{ tasks: Task[], total: number }>' is not 
// assignable to parameter of type 'Step<{ count: number }>'
```

### 2. ✅ Runtime Validation

```typescript
import { validateWorkflowTypes } from '@c4c/workflow';

const validation = validateWorkflowTypes(workflow, procedureRegistry);
// Result:
// {
//   valid: false,
//   errors: [{
//     nodeId: 'get-tasks',
//     error: 'Type mismatch: get-tasks output is not compatible with send-notification input'
//   }]
// }
```

### 3. ✅ Type-Safe Cross-App Calls

**Before:**
```typescript
// Calling App A from App B - no type checking
const result = await execute(registry, 'task-manager.tasks.list', { 
  status: 'invalid' // ❌ No error!
});
// result is 'unknown' type
```

**After:**
```typescript
// With module augmentation:
declare module "@c4c/core" {
  interface ProcedureTypeMap {
    "task-manager.tasks.list": Procedure<TasksListInput, TasksListOutput>;
  }
}

const result = await executeTyped(registry, 'task-manager.tasks.list', {
  status: 'invalid' // ❌ TypeScript error: not assignable to 'todo' | 'in_progress' | 'done'
});
// result is TasksListOutput - fully typed!
```

### 4. ✅ IDE Autocomplete

**Before:**
```typescript
engine.run('task-manager.tasks.list', { /* ??? */ });
// No autocomplete for procedure name or parameters
```

**After:**
```typescript
engine.run('task-manager.tasks.list', { 
  status: // ✅ IDE shows: 'todo' | 'in_progress' | 'done'
});
```

## Side-by-Side Comparison

### Original Code (Unsafe)

```typescript
// ❌ Problems:
// 1. Type mismatch not detected
// 2. No autocomplete
// 3. Runtime-only errors
// 4. Refactoring is dangerous

const getTasks = step({
  id: 'get-tasks',
  output: z.object({
    tasks: z.array(TaskSchema),
    total: z.number(),
  }),
  execute: ({ engine }) => 
    engine.run('task-manager.tasks.list', { status: 'in_progress' }),
});

const sendNotif = step({
  id: 'send-notification',
  input: z.object({
    count: z.number(), // ❌ MISMATCH!
  }),
  execute: ({ engine, inputData }) => 
    engine.run('notifications.send', {
      message: `⚠️ You have ${inputData.count} overdue tasks!`,
    }),
});

// ❌ No error - bug ships to production
workflow().step(getTasks).step(sendNotif).commit();
```

### Type-Safe Version (Safe)

```typescript
// ✅ Benefits:
// 1. Type errors at compile-time
// 2. Full autocomplete
// 3. Pre-deployment validation
// 4. Safe refactoring

// Define types
declare module "@c4c/core" {
  interface ProcedureTypeMap {
    "task-manager.tasks.list": Procedure<TasksListInput, TasksListOutput>;
    "notifications.send": Procedure<NotifInput, NotifOutput>;
  }
}

const getTasks = step({
  id: 'get-tasks',
  procedure: 'task-manager.tasks.list', // ✅ Autocomplete
  input: z.object({ status: z.literal('in_progress') }),
  output: z.object({
    tasks: z.array(TaskSchema),
    total: z.number(),
  }),
});

const sendNotif = step({
  id: 'send-notification',
  procedure: 'notifications.send', // ✅ Autocomplete
  input: z.object({
    message: z.string(),
    channel: z.enum(['email', 'sms', 'push', 'webhook']),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
  }),
  output: NotificationSchema,
});

// ❌ TypeScript error immediately:
// "Type '{ tasks: Task[]; total: number }' is not assignable to type '{ message: string; ... }'"
workflow()
  .step(getTasks)
  .step(sendNotif) // Error here!
  .commit();

// ✅ Fix: Add transformation or use execute with proper mapping
```

## Real-World Impact

### Scenario: Refactoring Task Schema

**Before (Unsafe):**
```typescript
// Developer changes tasks.list output:
- output: z.object({ tasks: z.array(...), total: z.number() })
+ output: z.object({ items: z.array(...), count: z.number() })

// ❌ All dependent workflows break silently at runtime
// ❌ Discovered only in production
```

**After (Safe):**
```typescript
// Developer changes tasks.list output:
- output: z.object({ tasks: z.array(...), total: z.number() })
+ output: z.object({ items: z.array(...), count: z.number() })

// ✅ TypeScript immediately shows ALL affected workflows
// ✅ IDE highlights every broken reference
// ✅ Fix before commit
```

### Scenario: Cross-Team Integration

**Before (Unsafe):**
```
App A Team: "We changed the tasks.list API"
App B Team: "Okay, we'll update our code"
App B Team: *Updates code, thinks it works*
Runtime: ❌ TypeError: Cannot read property 'tasks' of undefined
```

**After (Safe):**
```
App A Team: "We changed the tasks.list API"
App B Team: *Pulls changes*
TypeScript: ❌ 15 type errors in app-b/workflows/
App B Team: ✅ Fixes all errors before commit
Runtime: ✅ Everything works
```

## How to Enable

1. **Add procedure type map:**
```typescript
declare module "@c4c/core" {
  interface ProcedureTypeMap {
    "task-manager.tasks.list": Procedure<TasksListInput, TasksListOutput>;
    // ... all your procedures
  }
}
```

2. **Use typed registry:**
```typescript
import { createTypedRegistry, executeTyped } from '@c4c/core';

const registry = createTypedRegistry();
const result = await executeTyped(registry, 'task-manager.tasks.list', input);
```

3. **Validate workflows:**
```typescript
import { validateWorkflowTypes } from '@c4c/workflow';

const validation = validateWorkflowTypes(workflow, procedureRegistry);
if (!validation.valid) {
  throw new Error(`Workflow validation failed: ${validation.errors}`);
}
```

## Conclusion

The new type system **prevents bugs** by:
- ✅ Catching type mismatches at compile-time
- ✅ Validating workflows before deployment
- ✅ Providing full IDE support
- ✅ Making refactoring safe
- ✅ Enabling cross-app type safety

The original workflow has a bug that would only be discovered at runtime.
With the new type system, this bug is **impossible** - it won't even compile.
