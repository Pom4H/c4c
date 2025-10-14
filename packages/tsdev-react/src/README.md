# Workflow React Hooks

React hooks for executing and managing workflows in your application.

## Installation

The hooks are part of the core framework:

```typescript
import { useWorkflow, useWorkflows, useWorkflowDefinition } from '@/lib/hooks/useWorkflow';
// Or if using the framework directly:
// import { useWorkflow } from 'tsdev/core/workflow/react';
```

## Available Hooks

### `useWorkflow(options?)`

Execute workflows with automatic state management.

**Options:**
- `apiBaseUrl?: string` - Base URL for API endpoints (default: `/api/workflow`)
- `onSuccess?: (result) => void` - Callback when workflow completes successfully
- `onError?: (error) => void` - Callback when workflow execution fails

**Returns:**
- `execute(workflowId, input?)` - Function to execute a workflow
- `result` - Execution result (null if not executed)
- `isExecuting` - Loading state
- `error` - Error state (null if no error)
- `reset()` - Reset state

**Example:**

```tsx
function WorkflowExecutor() {
  const { execute, result, isExecuting, error } = useWorkflow({
    onSuccess: (result) => {
      console.log('Workflow completed!', result);
      // Show success notification
    },
    onError: (err) => {
      console.error('Workflow failed:', err);
      // Show error notification
    }
  });

  const handleExecute = async () => {
    try {
      await execute('my-workflow-id', { 
        userId: '123',
        action: 'process' 
      });
    } catch (err) {
      // Error already handled by onError callback
    }
  };

  return (
    <div>
      <button 
        onClick={handleExecute} 
        disabled={isExecuting}
      >
        {isExecuting ? 'Executing...' : 'Execute Workflow'}
      </button>

      {result && (
        <div>
          <p>Status: {result.status}</p>
          <p>Execution Time: {result.executionTime}ms</p>
          <p>Nodes Executed: {result.nodesExecuted.length}</p>
        </div>
      )}

      {error && (
        <div className="error">
          Error: {error.message}
        </div>
      )}
    </div>
  );
}
```

### `useWorkflows(options?)`

Fetch list of available workflows.

**Options:**
- `apiBaseUrl?: string` - Base URL for API endpoints (default: `/api/workflow`)

**Returns:**
- `workflows` - Array of available workflows
- `isLoading` - Loading state
- `error` - Error state (null if no error)
- `fetchWorkflows()` - Function to fetch workflows

**Example:**

```tsx
function WorkflowSelector() {
  const { workflows, isLoading, error, fetchWorkflows } = useWorkflows();
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  if (isLoading) return <div>Loading workflows...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <select 
      value={selectedId} 
      onChange={(e) => setSelectedId(e.target.value)}
    >
      <option value="">Select a workflow</option>
      {workflows.map((wf) => (
        <option key={wf.id} value={wf.id}>
          {wf.name} ({wf.nodeCount} nodes)
        </option>
      ))}
    </select>
  );
}
```

### `useWorkflowDefinition(workflowId, options?)`

Fetch detailed workflow definition.

**Parameters:**
- `workflowId: string | null` - ID of workflow to fetch (null to skip)

**Options:**
- `apiBaseUrl?: string` - Base URL for API endpoints (default: `/api/workflow`)

**Returns:**
- `definition` - Workflow definition (null if not loaded)
- `isLoading` - Loading state
- `error` - Error state (null if no error)
- `fetchDefinition()` - Function to fetch definition

**Example:**

```tsx
function WorkflowDetails({ workflowId }: { workflowId: string | null }) {
  const { definition, isLoading, error, fetchDefinition } = useWorkflowDefinition(workflowId);

  useEffect(() => {
    if (workflowId) {
      fetchDefinition();
    }
  }, [workflowId, fetchDefinition]);

  if (!workflowId) return null;
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!definition) return null;

  return (
    <div>
      <h2>{definition.name}</h2>
      <p>{definition.description}</p>
      <p>Version: {definition.version}</p>
      <p>Nodes: {definition.nodes.length}</p>
      
      <ul>
        {definition.nodes.map((node) => (
          <li key={node.id}>
            {node.id} - {node.type}
            {node.procedureName && ` (${node.procedureName})`}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Complete Example

Combining all hooks for a full workflow management UI:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { 
  useWorkflow, 
  useWorkflows, 
  useWorkflowDefinition 
} from '@/lib/hooks/useWorkflow';

export default function WorkflowManager() {
  const [selectedId, setSelectedId] = useState<string>('');

  // Fetch available workflows
  const { workflows, fetchWorkflows } = useWorkflows();
  
  // Get selected workflow definition
  const { definition, fetchDefinition } = useWorkflowDefinition(selectedId);
  
  // Execute workflow
  const { execute, result, isExecuting, error } = useWorkflow({
    onSuccess: (result) => {
      console.log('Workflow completed successfully:', result);
    }
  });

  // Load workflows on mount
  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Load definition when selection changes
  useEffect(() => {
    if (selectedId) {
      fetchDefinition();
    }
  }, [selectedId, fetchDefinition]);

  const handleExecute = () => {
    if (selectedId) {
      execute(selectedId, { /* input data */ });
    }
  };

  return (
    <div>
      {/* Workflow Selector */}
      <select 
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        disabled={isExecuting}
      >
        <option value="">Select workflow...</option>
        {workflows.map((wf) => (
          <option key={wf.id} value={wf.id}>
            {wf.name}
          </option>
        ))}
      </select>

      {/* Execute Button */}
      <button 
        onClick={handleExecute}
        disabled={!selectedId || isExecuting}
      >
        {isExecuting ? 'Executing...' : 'Execute Workflow'}
      </button>

      {/* Workflow Details */}
      {definition && (
        <div>
          <h2>{definition.name}</h2>
          <p>{definition.description}</p>
        </div>
      )}

      {/* Execution Result */}
      {result && (
        <div>
          <h3>Result</h3>
          <p>Status: {result.status}</p>
          <p>Time: {result.executionTime}ms</p>
          <p>Nodes: {result.nodesExecuted.join(' → ')}</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error">
          Error: {error.message}
        </div>
      )}
    </div>
  );
}
```

## API Routes Setup

The hooks require corresponding API routes. Example setup:

```typescript
// app/api/workflow/execute/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from '@/lib/workflow/runtime';

export async function POST(request: NextRequest) {
  const { workflowId, input } = await request.json();
  const workflow = getWorkflow(workflowId); // Your workflow lookup
  const result = await executeWorkflow(workflow, input);
  return NextResponse.json(result);
}

// app/api/workflow/list/route.ts
export async function GET() {
  const workflows = getAllWorkflows(); // Your workflow list
  return NextResponse.json({ workflows });
}

// app/api/workflow/definition/route.ts
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const definition = getWorkflow(id);
  return NextResponse.json({ definition });
}
```

## TypeScript Types

```typescript
interface WorkflowExecutionResult {
  executionId: string;
  status: 'completed' | 'failed' | 'cancelled';
  outputs: Record<string, unknown>;
  error?: string;
  executionTime: number;
  nodesExecuted: string[];
  spans: TraceSpan[];
}

interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: WorkflowNode[];
  startNode: string;
  variables?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface WorkflowNode {
  id: string;
  type: 'procedure' | 'condition' | 'parallel' | 'sequential';
  procedureName?: string;
  config?: Record<string, unknown>;
  next?: string | string[];
  onError?: string;
}
```

## Best Practices

### 1. Error Handling

Always provide error callbacks and handle errors gracefully:

```tsx
const { execute, error } = useWorkflow({
  onError: (err) => {
    // Log to error tracking service
    logError(err);
    // Show user-friendly message
    showNotification('Workflow execution failed');
  }
});
```

### 2. Loading States

Disable UI interactions during execution:

```tsx
<button disabled={isExecuting}>
  {isExecuting ? 'Processing...' : 'Execute'}
</button>
```

### 3. State Reset

Reset state when component unmounts or workflow changes:

```tsx
const { reset } = useWorkflow();

useEffect(() => {
  return () => reset(); // Cleanup
}, [reset]);
```

### 4. Memoization

Memoize callbacks to prevent unnecessary re-renders:

```tsx
const handleSuccess = useCallback((result) => {
  console.log('Success:', result);
}, []);

const { execute } = useWorkflow({
  onSuccess: handleSuccess
});
```

## Framework Integration

These hooks integrate seamlessly with the framework's workflow runtime:

- ✅ Automatic OTEL tracing
- ✅ Type-safe execution
- ✅ Contract validation
- ✅ Error handling
- ✅ State management
- ✅ Loading indicators

All workflow execution happens server-side with full observability through OpenTelemetry.
