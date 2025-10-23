# @c4c/workflow-react

React hooks for workflow integration.

## Installation

```bash
pnpm add @c4c/workflow-react react
```

## Overview

`@c4c/workflow-react` provides:

- `useWorkflow` hook
- `useWorkflowStatus` hook
- Type-safe workflow execution
- Suspense support

## Quick Example

```typescript
import { useWorkflow } from "@c4c/workflow-react";

function MyComponent() {
  const { execute, result, loading, error } = useWorkflow("my-workflow");
  
  const handleClick = () => {
    execute({ name: "Alice" });
  };
  
  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        {loading ? "Loading..." : "Execute"}
      </button>
      {result && <div>Result: {JSON.stringify(result)}</div>}
      {error && <div>Error: {error.message}</div>}
    </div>
  );
}
```

## API

### useWorkflow

```typescript
const { execute, result, loading, error } = useWorkflow(workflowId);
```

### useWorkflowStatus

```typescript
const { status, progress } = useWorkflowStatus(executionId);
```

## Next Steps

- [Learn about Workflows](/guide/workflows)
- [View Examples](/examples/modules)
