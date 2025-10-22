# Workflow UI - Backend Separation Changes

## Summary

The workflow UI frontend has been modified to **no longer execute workflows directly**. Instead, it now **proxies all requests to the backend server** running on port 3000.

## What Changed

### Backend Server (`packages/adapters/src/workflow-http.ts`)

Added new endpoints to the workflow HTTP router:

1. **`GET /workflow/executions`** - Lists all workflow executions with stats
   - Returns execution history and statistics
   - Used by the UI to display the executions list

2. **`GET /workflow/executions/:executionId`** - Gets details for a specific execution
   - Returns full execution details including node status
   - Used by the UI to display execution details

### Frontend Configuration (`apps/workflow/src/lib/config.ts`)

Created a new configuration file that reads environment variables:

```typescript
export const config = {
  apiBase: process.env.NEXT_PUBLIC_C4C_API_BASE || "http://localhost:3000",
  workflowStreamBase: process.env.NEXT_PUBLIC_C4C_WORKFLOW_STREAM_BASE || "..."
};
```

These environment variables are automatically set by the CLI when running `pnpm c4c serve ui`.

### Frontend API Routes (all modified to proxy to backend)

All routes in `apps/workflow/src/app/api/workflow/` now proxy requests to the backend:

1. **`POST /api/workflow/execute`** - Proxies workflow execution requests
2. **`GET /api/workflow/executions`** - Proxies executions list requests
3. **`GET /api/workflow/executions/:id`** - Proxies execution detail requests
4. **`GET /api/workflow/executions/:id/stream`** - Proxies SSE stream
5. **`GET /api/workflow/definitions`** - Proxies workflow definitions list
6. **`GET /api/workflow/definitions/:id`** - Proxies workflow definition details

### What Was Removed

- Direct imports of `executeWorkflow` from `@c4c/workflow` in frontend
- Direct imports of `collectRegistry` from `@c4c/core` in frontend
- Direct imports of workflow definitions from examples
- Direct access to `getExecutionStore()` in frontend
- All workflow execution logic from the frontend

## How It Works Now

### Architecture

```
┌─────────────────────────────────────┐
│  Frontend (Next.js on port 3100)    │
│  - UI Components                    │
│  - API Routes (proxy only)          │
└──────────────┬──────────────────────┘
               │ HTTP/SSE
               ▼
┌─────────────────────────────────────┐
│  Backend Server (Hono on port 3000) │
│  - Workflow Execution               │
│  - Procedure Registry               │
│  - Execution Store                  │
│  - SSE Event Emitter                │
└─────────────────────────────────────┘
```

### Workflow Execution Flow

1. User clicks "Execute" in the UI (port 3100)
2. Frontend sends `POST` to `/api/workflow/execute`
3. Frontend API route proxies to backend `http://localhost:3000/workflow/execute`
4. **Backend executes the workflow** (not the frontend!)
5. Backend stores execution in ExecutionStore
6. Backend returns execution result
7. Frontend receives result and displays it
8. Frontend opens SSE connection to backend for live updates

### SSE (Server-Sent Events) Flow

1. Frontend opens SSE connection to `/api/workflow/executions/:id/stream`
2. Frontend API route proxies SSE stream from backend
3. Backend emits events (`node.started`, `node.completed`, `workflow.completed`)
4. Events flow through frontend proxy to browser
5. UI updates in real-time

## Running the System

### Start Backend Server

```bash
pnpm c4c serve all
```

This starts the backend server on port 3000 with all workflow execution logic.

### Start Frontend UI

```bash
pnpm c4c serve ui
```

This starts the frontend UI on port 3100, which will automatically connect to the backend on port 3000.

### Environment Variables

The CLI automatically sets these when running `pnpm c4c serve ui`:

- `C4C_API_BASE=http://localhost:3000`
- `NEXT_PUBLIC_C4C_API_BASE=http://localhost:3000`
- `NEXT_PUBLIC_C4C_WORKFLOW_STREAM_BASE=http://localhost:3000/workflow/executions`

## Benefits

✅ **Proper separation of concerns** - Frontend only handles UI, backend handles execution
✅ **Scalability** - Backend can be scaled independently
✅ **Security** - Sensitive operations happen only on backend
✅ **SSE still works** - Real-time updates via proxied SSE connection
✅ **No code duplication** - Single execution logic in backend
✅ **Better architecture** - Follows standard client-server pattern

## Testing

To verify the changes work:

1. Start backend: `pnpm c4c serve all`
2. Start frontend: `pnpm c4c serve ui --api-base http://localhost:3000`
3. Open browser to `http://localhost:3100`
4. Execute a workflow
5. Verify execution appears and updates in real-time
6. Check backend logs to confirm execution happens server-side

## Migration Notes

If you have custom code that was using the frontend to execute workflows:

1. Remove any direct imports of `@c4c/workflow` execution functions
2. Use the API routes instead: `fetch('/api/workflow/execute', ...)`
3. Ensure backend server is running before starting frontend
4. Update any hardcoded URLs to use the `config.apiBase` variable
