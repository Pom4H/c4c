# Next.js Workflow Viz - Refactoring Notes

## Structure After Refactoring

This example now follows the framework's philosophy:

### Core Runtime (from framework)
- Uses `src/core/workflow/runtime.ts` from the framework
- Full OTEL integration
- Contract-based procedure execution

### Demo-Specific Files

#### Mock Data
- `src/lib/workflow/mock-procedures.ts` - Demo procedures for visualization
- `src/lib/workflow/mock-registry.ts` - Creates registry from mock procedures
- `src/lib/workflow/span-collector.ts` - Simple span collector for UI visualization

#### Adapters
- `src/lib/workflow/runtime.ts` - Thin wrapper around core runtime
  - Uses framework's executeWorkflow
  - Adds mock procedures
  - Collects spans for UI visualization
- `src/lib/workflow/core-runtime.ts` - Re-exports from framework core

#### UI Hooks
- `src/lib/hooks/useWorkflow.ts` - React hooks for workflow management

#### API Routes
- `src/app/api/workflow/execute/route.ts` - Execute endpoint
- `src/app/api/workflow/list/route.ts` - List workflows endpoint
- `src/app/api/workflow/definition/route.ts` - Get definition endpoint

### What's NOT in the Example

❌ Business logic in components
❌ Custom runtime implementation (uses framework)
❌ Server Actions (replaced with API routes)
❌ Mixed concerns (clean separation)

### What IS in the Example

✅ Pure UI components (React Flow visualization)
✅ Framework runtime with mock procedures
✅ API routes for backend logic
✅ React hooks for state management
✅ Span collection for visualization

## Key Differences from Original

### Before
```tsx
// Component with logic
const [result, setResult] = useState();
const execute = async () => {
  // Custom runtime execution
  const res = await customExecuteWorkflow(workflow);
  setResult(res);
};
```

### After
```tsx
// Pure UI component
const { execute, result, isExecuting } = useWorkflow();
// Hook handles everything
```

### Runtime Flow

```
User clicks Execute
    ↓
useWorkflow hook
    ↓
POST /api/workflow/execute
    ↓
examples/.../runtime.ts (thin wrapper)
    ↓
src/core/workflow/runtime.ts (framework)
    ↓
Mock Registry (demo procedures)
    ↓
Span Collector (for UI)
    ↓
Result with spans → UI
```

## Files Purpose

### Core Runtime Files (from framework)
- `/src/core/workflow/runtime.ts` - Workflow execution engine
- `/src/core/workflow/types.ts` - Type definitions
- `/src/core/workflow/react/useWorkflow.ts` - React hooks

### Demo-Specific Files
- `mock-procedures.ts` - 🎭 Demo procedures (would be real in production)
- `mock-registry.ts` - 🎭 Registry builder (would use framework registry)
- `span-collector.ts` - 📊 UI visualization helper (would use OTEL exporter)
- `runtime.ts` - 🔌 Adapter that combines framework + mocks
- `core-runtime.ts` - 📦 Re-export for clean imports

### React Integration
- `hooks/useWorkflow.ts` - Framework hooks wrapper
- `app/page.tsx` - Pure UI component
- `components/*.tsx` - Presentational components only

## Production vs Demo

### In Demo
```typescript
// Uses mock procedures
const mockRegistry = createMockRegistry();
const result = await executeWorkflow(workflow, mockRegistry);
```

### In Production
```typescript
// Would use real framework registry
import { collectRegistry } from 'tsdev/core';
const registry = await collectRegistry('src/handlers');
const result = await executeWorkflow(workflow, registry);
```

## Running the Example

```bash
npm install
npm run dev
```

Visit http://localhost:3000

The example demonstrates:
- ✅ Framework runtime integration
- ✅ OTEL tracing (simulated for demo)
- ✅ Pure UI components
- ✅ API routes instead of Server Actions
- ✅ React hooks for state management
