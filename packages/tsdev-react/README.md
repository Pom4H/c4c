# tsdev-react

React hooks for tsdev workflow system.

## Installation

```bash
pnpm add tsdev-react tsdev react
```

## Usage

```tsx
import { useWorkflow } from 'tsdev-react';

function MyComponent() {
  const { execute, result, isExecuting, error } = useWorkflow({
    onSuccess: (result) => console.log('Workflow completed!', result),
    onError: (err) => console.error('Workflow failed:', err)
  });

  const handleExecute = async () => {
    await execute('my-workflow-id', { input: 'data' });
  };

  return (
    <div>
      <button onClick={handleExecute} disabled={isExecuting}>
        Execute Workflow
      </button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
      {error && <div>Error: {error.message}</div>}
    </div>
  );
}
```

## API

### `useWorkflow(options?)`

Hook for executing workflows via API.

**Options:**
- `apiBaseUrl?: string` - Base URL for workflow API (default: `/api/workflow`)
- `onSuccess?: (result) => void` - Success callback
- `onError?: (error) => void` - Error callback

**Returns:**
- `execute: (workflowId, input?) => Promise<WorkflowExecutionResult>` - Execute workflow
- `result: WorkflowExecutionResult | null` - Execution result
- `isExecuting: boolean` - Loading state
- `error: Error | null` - Error state
- `reset: () => void` - Reset state

### `useWorkflows(options?)`

Hook for fetching available workflows.

### `useWorkflowDefinition(workflowId, options?)`

Hook for fetching workflow definition.

## Philosophy

This package follows tsdev's philosophy:
- **UI layer only handles presentation** - business logic stays in core runtime
- **Type-safe** - full TypeScript support
- **Transport-agnostic** - works with any API backend

## License

MIT
