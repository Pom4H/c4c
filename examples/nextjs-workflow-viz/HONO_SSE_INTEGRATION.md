# Hono SSE Integration for Workflow Execution

## Overview

This document describes the integration of Hono with Server-Sent Events (SSE) for workflow execution in the Next.js application. The previous implementation used Next.js Server Actions, which has been replaced with a Hono-based SSE endpoint for real-time workflow execution streaming.

## Architecture

### Components

1. **Hono App** (`src/lib/workflow/hono-app.ts`)
   - Defines the Hono application with workflow endpoints
   - Implements SSE streaming for workflow execution
   - Provides REST endpoints for fetching workflows and definitions

2. **Next.js API Route** (`src/app/api/[[...route]]/route.ts`)
   - Integrates Hono app directly into Next.js
   - Uses `hono/vercel` adapter to handle Next.js requests
   - Runs Hono in the same process as Next.js (no separate server needed)

3. **SSE Client** (`src/lib/workflow/sse-client.ts`)
   - Client-side module for consuming SSE endpoints
   - Implements workflow execution with real-time progress streaming
   - Provides fetch functions for workflow metadata

4. **Updated Page Component** (`src/app/page.tsx`)
   - Replaced Server Actions with SSE client calls
   - Implements real-time progress callbacks
   - Maintains same UI/UX with improved streaming capabilities

## API Endpoints

### GET `/api/workflows`
Returns list of available workflows with metadata.

**Response:**
```json
[
  {
    "id": "math-calculation",
    "name": "Math Calculation",
    "description": "...",
    "version": "1.0.0",
    "nodeCount": 3,
    "metadata": {}
  }
]
```

### GET `/api/workflows/:id`
Returns complete workflow definition by ID.

**Response:**
```json
{
  "id": "math-calculation",
  "name": "Math Calculation",
  "nodes": [...],
  "startNode": "start",
  ...
}
```

### POST `/api/workflows/:id/execute`
Executes a workflow with SSE streaming.

**Request Body:**
```json
{
  "input": {
    "a": 10,
    "b": 5
  }
}
```

**SSE Events:**

1. `workflow-start` - Workflow execution started
```json
{
  "type": "start",
  "workflowId": "math-calculation",
  "workflowName": "Math Calculation",
  "timestamp": 1234567890
}
```

2. `workflow-progress` - Node executed (sent for each node)
```json
{
  "type": "node-executed",
  "nodeId": "node1",
  "timestamp": 1234567891
}
```

3. `workflow-complete` - Workflow completed successfully
```json
{
  "type": "complete",
  "result": {
    "executionId": "exec_...",
    "status": "completed",
    "outputs": {...},
    "executionTime": 1500,
    "nodesExecuted": ["node1", "node2", "node3"],
    "spans": [...]
  },
  "timestamp": 1234567892
}
```

4. `workflow-error` - Workflow execution failed
```json
{
  "type": "error",
  "error": "Error message",
  "timestamp": 1234567893
}
```

## Benefits

1. **Real-time Streaming**: SSE provides real-time progress updates during workflow execution
2. **No Separate Server**: Hono runs directly in Next.js using the Vercel adapter
3. **Type Safety**: Full TypeScript support throughout the stack
4. **Scalability**: SSE is more efficient than polling for real-time updates
5. **Framework Flexibility**: Hono can be easily moved to a standalone server if needed

## Dependencies

- `hono` - Lightweight web framework
- `@hono/node-server` - Node.js adapter for Hono (not used in this integration, but available)
- `hono/vercel` - Vercel adapter for Next.js integration
- `hono/streaming` - SSE streaming utilities

## Migration Notes

### Removed
- `src/app/actions.ts` - Next.js Server Actions (replaced with Hono endpoints)

### Added
- `src/lib/workflow/hono-app.ts` - Hono application definition
- `src/app/api/[[...route]]/route.ts` - Next.js API route handler
- `src/lib/workflow/sse-client.ts` - SSE client utilities

### Modified
- `src/app/page.tsx` - Updated to use SSE client instead of Server Actions
- Updated UI text to reflect Hono SSE usage

## Usage

### Client-side Workflow Execution

```typescript
import { executeWorkflowSSE } from "@/lib/workflow/sse-client";

await executeWorkflowSSE("math-calculation", { a: 10, b: 5 }, {
  onStart: (event) => {
    console.log("Started:", event.workflowName);
  },
  onProgress: (event) => {
    console.log("Node executed:", event.nodeId);
  },
  onComplete: (event) => {
    console.log("Result:", event.result);
  },
  onError: (event) => {
    console.error("Error:", event.error);
  },
});
```

### Fetching Workflows

```typescript
import { fetchWorkflows, fetchWorkflowDefinition } from "@/lib/workflow/sse-client";

// Get all workflows
const workflows = await fetchWorkflows();

// Get specific workflow
const workflow = await fetchWorkflowDefinition("math-calculation");
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Future Enhancements

1. **Authentication**: Add authentication middleware to Hono routes
2. **Rate Limiting**: Implement rate limiting for workflow execution
3. **Workflow Cancellation**: Add ability to cancel running workflows
4. **Progress Percentage**: Calculate and stream execution progress percentage
5. **Workflow History**: Store and retrieve workflow execution history
