# Workflow Module Refactoring Summary

## Overview

The workflow module has been refactored to follow the framework's philosophy more closely. All core workflow functionality has been moved to `src/core/workflow`, and React integration has been added via hooks.

## Changes Made

### 1. Core Workflow Module (`src/core/workflow/`)

**New Structure:**
```
src/core/workflow/
├── types.ts           # Workflow type definitions
├── runtime.ts         # Workflow execution engine with OTEL tracing
├── index.ts           # Module exports
└── react/
    ├── index.ts       # React exports
    └── useWorkflow.ts # React hooks for workflow execution
```

**Key Features:**
- Full OpenTelemetry integration out of the box
- Uses framework's `executeProcedure` and `createExecutionContext`
- Automatic span creation for workflows, nodes, and procedures
- Hierarchical tracing: `workflow → node → procedure → policies`

### 2. React Hooks (`src/core/workflow/react/`)

**Available Hooks:**
- `useWorkflow()` - Execute workflows with loading/error states
- `useWorkflows()` - Fetch available workflows
- `useWorkflowDefinition()` - Fetch workflow definitions

**Example Usage:**
```tsx
const { execute, result, isExecuting, error } = useWorkflow({
  onSuccess: (result) => console.log('Workflow completed!', result),
  onError: (err) => console.error('Failed:', err)
});

await execute('my-workflow-id', { input: 'data' });
```

### 3. Next.js Example Refactoring

**Before:**
- Server Actions in `src/app/actions.ts`
- Logic mixed in components
- Custom workflow runtime with mock procedures

**After:**
- API Routes in `src/app/api/workflow/`
  - `/api/workflow/execute` - Execute workflow
  - `/api/workflow/list` - List workflows
  - `/api/workflow/definition` - Get workflow definition
- Pure UI components using framework hooks
- All logic handled by framework core

**New Component Structure:**
```tsx
// page.tsx - Pure UI component
const { execute, result } = useWorkflow();
const { workflows } = useWorkflows();
const { definition } = useWorkflowDefinition(selectedId);

// All logic handled by hooks and API routes
```

### 4. Updated Exports

**Main Framework Exports (`src/index.ts`):**
```typescript
// Workflow types now from core/workflow
export type { WorkflowDefinition, WorkflowNode, ... } from "./core/workflow/types.js";
export { executeWorkflow, validateWorkflow } from "./core/workflow/runtime.js";
```

**Core Module Exports (`src/core/index.ts`):**
```typescript
// Now includes workflow module
export * from "./workflow/index.js";
```

## Philosophy Alignment

### 1. **Contracts-First Architecture**
- Workflows are compositions of procedures with contracts
- Each procedure maintains its input/output validation
- Workflow runtime uses framework's `executeProcedure`

### 2. **Transport-Agnostic Core**
- Workflow runtime doesn't know about HTTP/React/etc.
- Same workflow execution works via API, CLI, or direct calls
- UI layer (React hooks) calls API routes
- API routes call core runtime

### 3. **OTEL by Design**
- Workflow execution creates automatic span hierarchy
- Uses framework's existing OTEL tracer
- Procedures create their own spans via `withSpan` policy
- Full observability: workflow → nodes → procedures → policies

### 4. **Zero Boilerplate**
- React hooks auto-manage state
- API routes auto-parse requests
- No manual span creation needed
- Framework handles all tracing

### 5. **Composability**
- Workflows compose procedures
- Procedures use policies (`withSpan`, `withRetry`, etc.)
- UI layer uses hooks
- Clean separation of concerns

## Migration Guide

### For Existing Workflow Code

**Old Import:**
```typescript
import { WorkflowDefinition } from '../src/workflow/types.js';
import { executeWorkflow } from '../src/workflow/runtime.js';
```

**New Import:**
```typescript
import { WorkflowDefinition } from '../src/core/workflow/types.js';
import { executeWorkflow } from '../src/core/workflow/runtime.js';
// Or from main index
import { WorkflowDefinition, executeWorkflow } from '../src/index.js';
```

### For React Applications

**Old Pattern (Server Actions):**
```typescript
// actions.ts
"use server";
export async function executeWorkflowAction(id: string) {
  return await executeWorkflow(...);
}

// page.tsx
const result = await executeWorkflowAction(id);
```

**New Pattern (Hooks + API Routes):**
```typescript
// API Route: app/api/workflow/execute/route.ts
export async function POST(request: NextRequest) {
  const { workflowId, input } = await request.json();
  return NextResponse.json(await executeWorkflow(...));
}

// Component: page.tsx
const { execute, result, isExecuting } = useWorkflow();
await execute(workflowId, input);
```

## Benefits

### 1. **Better Separation of Concerns**
- Core: Pure workflow execution with OTEL
- API: HTTP/REST handling
- UI: State management and rendering

### 2. **Improved Testability**
- Core runtime can be tested independently
- React hooks can be tested with mock API
- API routes can be tested with mock workflows

### 3. **Framework Integration**
- Uses framework's OTEL setup
- Uses framework's execution context
- Uses framework's procedure registry
- Follows framework's conventions

### 4. **Enhanced Developer Experience**
- Simple hooks API for React
- Clear API endpoints
- Type-safe throughout
- No boilerplate code

### 5. **Production Ready**
- Automatic error handling
- Loading states built-in
- OTEL tracing out of the box
- RESTful API design

## Example: Full Workflow Execution Flow

```
1. User clicks "Execute Workflow" button
   ↓
2. Component calls useWorkflow hook
   const { execute } = useWorkflow();
   await execute('my-workflow', { input });
   ↓
3. Hook makes POST request to API
   POST /api/workflow/execute
   Body: { workflowId: 'my-workflow', input: { ... } }
   ↓
4. API route receives request
   NextRequest → JSON → { workflowId, input }
   ↓
5. API calls core runtime
   await executeWorkflow(workflow, registry, input)
   ↓
6. Runtime creates OTEL span hierarchy
   workflow.execute (root span)
   ├─ workflow.node.procedure
   │  └─ procedure.name (from withSpan policy)
   ├─ workflow.node.condition
   └─ workflow.node.parallel
      ├─ parallel.branch
      └─ parallel.branch
   ↓
7. Runtime returns result with trace spans
   { executionId, status, outputs, spans, ... }
   ↓
8. API route returns JSON response
   NextResponse.json(result)
   ↓
9. Hook receives response
   setResult(result)
   onSuccess(result)
   ↓
10. Component re-renders with result
    Display workflow graph with execution highlights
```

## Testing

Run the Next.js example to test:

```bash
cd examples/nextjs-workflow-viz
npm install
npm run dev
```

Visit http://localhost:3000 to see:
- Workflow selection dropdown
- Execute button
- Real-time execution visualization
- OTEL trace collection
- Span Gantt chart
- Trace details view

## Future Enhancements

1. **WebSocket Support** - Real-time workflow execution updates
2. **Workflow Versioning** - Track and manage workflow versions
3. **Workflow Templates** - Pre-built workflow patterns
4. **Visual Editor** - Drag-and-drop workflow builder
5. **Workflow Debugging** - Step-through execution
6. **Workflow Scheduling** - Cron-like workflow execution
7. **Workflow Metrics** - Performance analytics dashboard

## Conclusion

This refactoring brings the workflow module in line with the framework's philosophy:
- **Contracts-first**: Workflows compose procedures with contracts
- **Transport-agnostic**: Core runtime independent of transport
- **OTEL by design**: Automatic tracing throughout
- **Zero boilerplate**: Hooks and API routes handle complexity
- **Composable**: Clean layers that work together seamlessly
