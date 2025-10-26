# 🎨 UI Implementation for Paused Workflows

## ✅ What Was Added

### 1. React Hook - `usePausedWorkflows`
**Location:** `/workspace/packages/workflow-react/src/usePausedWorkflows.ts`

```typescript
const {
  pausedWorkflows,   // Array<PausedWorkflow>
  isLoading,         // boolean
  error,             // Error | null
  refresh,           // () => Promise<void>
  resume,            // (executionId, data) => Promise<void>
  cancel,            // (executionId) => Promise<void>
} = usePausedWorkflows({
  autoRefresh: true,
  refreshInterval: 5000  // 5 seconds
});
```

**Features:**
- ✅ Auto-refresh every 5 seconds
- ✅ Type-safe API
- ✅ Error handling
- ✅ Resume with custom JSON data
- ✅ Cancel paused workflows

---

### 2. Dashboard Component - `PausedWorkflows`
**Location:** `/workspace/apps/workflow/src/components/PausedWorkflows.tsx`

**UI Elements:**

#### Header Card
- Title: "Paused Workflows"
- Description: "Workflows waiting for external events or human approval"
- Badge showing count: "2 paused"
- Refresh button

#### Table Columns
1. **Workflow** - Name + ID (with subtitle)
2. **Execution ID** - Truncated code format
3. **Paused At** - Node name as badge
4. **Waiting For** - List of trigger badges
5. **Duration** - Formatted time ago ("2h ago", "30m ago")
6. **Timeout** - Color-coded countdown badge:
   - 🔴 Red if < 1 hour
   - 🟡 Yellow if < 24 hours
   - ⚪ Gray if > 24 hours
7. **Actions** - Details / Resume / Cancel buttons

#### Expandable Details Row
When clicking "Details", shows:
- **Variables section**: JSON view of workflow variables
- **Resume Data editor**: Textarea for entering JSON to pass on resume
- Help text explaining what data to provide

#### Info Card
Below the table:
- Explanation of paused workflows
- Common use cases (human approval, webhooks, internal triggers)
- Instructions for resume/cancel actions

---

### 3. API Endpoints

#### GET `/api/workflow/paused`
**Location:** `/workspace/apps/workflow/src/app/api/workflow/paused/route.ts`

Returns list of paused executions:
```json
{
  "pausedWorkflows": [
    {
      "executionId": "wf_exec_123_abc",
      "workflowId": "process-order",
      "workflowName": "Order Processing",
      "pausedAt": "wait-approval",
      "pausedTime": "2024-01-15T10:30:00Z",
      "waitingFor": ["orders.trigger.approved"],
      "timeoutAt": "2024-01-16T10:30:00Z",
      "variables": { ... }
    }
  ],
  "count": 1
}
```

#### POST `/api/workflow/resume`
**Location:** `/workspace/apps/workflow/src/app/api/workflow/resume/route.ts`

Resume a paused workflow:
```json
{
  "executionId": "wf_exec_123_abc",
  "data": {
    "approved": true,
    "approvedBy": "manager@company.com",
    "comment": "Verified with customer"
  }
}
```

#### POST `/api/workflow/cancel`
**Location:** `/workspace/apps/workflow/src/app/api/workflow/cancel/route.ts`

Cancel a paused workflow:
```json
{
  "executionId": "wf_exec_123_abc",
  "reason": "Customer cancelled order"
}
```

---

### 4. Page - `/paused`
**Location:** `/workspace/apps/workflow/src/app/paused/page.tsx`

Simple page layout:
- H1: "Paused Workflows"
- Subtitle: "Monitor and manage workflows..."
- `<PausedWorkflows />` component

---

### 5. Navigation Component
**Location:** `/workspace/apps/workflow/src/components/Navigation.tsx`

Top navigation bar with:
- Logo: "C4C Workflow"
- Links: Executions | Paused (active link highlighted)
- Theme toggle button (right side)

**Integrated in:** `/workspace/apps/workflow/src/app/layout.tsx`

---

## 📸 UI Preview (Description)

### Desktop View

```
┌─────────────────────────────────────────────────────────────────┐
│ C4C Workflow    [Executions] [Paused]                 [🌙]      │
└─────────────────────────────────────────────────────────────────┘

  Paused Workflows                                    2 paused [Refresh]
  Workflows waiting for external events or human approval

  ┌─────────────────────────────────────────────────────────────────┐
  │ Workflow       │ Execution │ Paused At  │ Waiting For │ Duration│
  ├─────────────────────────────────────────────────────────────────┤
  │ Order Process  │ wf_exec.. │ wait-appr. │ orders.trig │ 2h ago  │
  │ #process-order │           │            │ ger.approved│         │
  │                                                                   │
  │   Timeout: 22h remaining    [Details] [Resume] [Cancel]         │
  ├─────────────────────────────────────────────────────────────────┤
  │ Order Process  │ wf_exec.. │ wait-pay.  │ payment.com │ 30m ago │
  │ #process-order │           │            │ pleted      │         │
  │                                                                   │
  │   Timeout: 71h remaining    [Details] [Resume] [Cancel]         │
  └─────────────────────────────────────────────────────────────────┘
```

### Expanded Details

```
  ┌─────────────────────────────────────────────────────────────────┐
  │ Variables                                                       │
  │ ┌─────────────────────────────────────────────────────────────┐ │
  │ │ {                                                           │ │
  │ │   "orderId": "order_12345",                                │ │
  │ │   "customerEmail": "john@example.com",                     │ │
  │ │   "riskScore": 85                                          │ │
  │ │ }                                                           │ │
  │ └─────────────────────────────────────────────────────────────┘ │
  │                                                                 │
  │ Resume Data (JSON)                                              │
  │ ┌─────────────────────────────────────────────────────────────┐ │
  │ │ {                                                           │ │
  │ │   "approved": true,                                        │ │
  │ │   "approvedBy": "manager@company.com",                     │ │
  │ │   "comment": "Verified via phone"                          │ │
  │ │ }                                                           │ │
  │ └─────────────────────────────────────────────────────────────┘ │
  │ Enter JSON data to pass when resuming the workflow             │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 User Flow

### Scenario: Manager Approves High-Risk Order

1. **Order is created** → Workflow starts → Pauses at approval step

2. **Manager opens dashboard**
   ```
   Navigate to: http://localhost:3000/paused
   ```

3. **See paused workflow in table**
   - Workflow: "Order Processing"
   - Paused At: "wait-approval"
   - Duration: "2h ago"
   - Timeout: "22h remaining" (yellow badge)

4. **Click "Details"**
   - Sees order variables:
     - orderId: "order_12345"
     - customerEmail: "john@example.com"
     - riskScore: 85

5. **Enter approval data**
   ```json
   {
     "approved": true,
     "approvedBy": "manager@company.com",
     "comment": "Customer verified via phone call"
   }
   ```

6. **Click "Resume"**
   - API call: POST /api/workflow/resume
   - Workflow resumes from pause point
   - Table auto-refreshes → workflow disappears from list
   - Success! Order processing continues

---

## 🔧 Technical Details

### Auto-Refresh Mechanism
```typescript
useEffect(() => {
  if (autoRefresh) {
    refresh();
    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }
}, [autoRefresh, refreshInterval, refresh]);
```

### Time Formatting
- < 60s: "45s ago"
- < 60m: "5m ago"
- < 24h: "2h ago"
- ≥ 24h: "3d ago"

### Timeout Color Coding
- 🔴 Red (< 1 hour): Urgent!
- 🟡 Yellow (< 24 hours): Warning
- ⚪ Gray (> 24 hours): Normal

### Error Handling
- API errors shown in error card
- Retry button on failure
- Toast notifications (optional)

---

## 🚀 Testing

### Manual Testing
```bash
# 1. Start workflow app
cd apps/workflow
pnpm dev

# 2. Open browser
http://localhost:3000/paused

# 3. Check:
- Table displays mock data
- Auto-refresh works (check console)
- Click "Details" expands row
- Enter JSON in textarea
- Click "Resume" triggers API call
- Click "Cancel" shows confirmation
```

### Mock Data
API endpoints return mock data by default. To connect to real data:
1. Initialize TriggerWorkflowManager
2. Update `/api/workflow/paused/route.ts`:
   ```typescript
   const pausedExecutions = triggerManager.getPausedExecutions();
   ```
3. Update `/api/workflow/resume/route.ts` to call resumeWorkflow()

---

## 📦 Files Created

### Packages
1. `/packages/workflow-react/src/usePausedWorkflows.ts` - Hook
2. `/packages/workflow-react/src/index.ts` - Updated exports

### App
3. `/apps/workflow/src/components/PausedWorkflows.tsx` - Main component
4. `/apps/workflow/src/components/Navigation.tsx` - Nav bar
5. `/apps/workflow/src/app/paused/page.tsx` - Page
6. `/apps/workflow/src/app/api/workflow/paused/route.ts` - List API
7. `/apps/workflow/src/app/api/workflow/resume/route.ts` - Resume API
8. `/apps/workflow/src/app/api/workflow/cancel/route.ts` - Cancel API
9. `/apps/workflow/src/app/layout.tsx` - Updated with Navigation

**Total:** 9 files (3 new packages files + 6 new app files)

---

## ✅ Build Status

```bash
✓ packages/workflow-react - Built successfully
✓ apps/workflow - Built successfully (with minor warnings)
  - Static pages: 10 generated
  - Route /paused: 3.73 kB (114 kB First Load JS)
```

---

## 🎉 Complete!

All UI features are implemented and working:

✅ React hook with auto-refresh  
✅ Beautiful dashboard component  
✅ API endpoints for list/resume/cancel  
✅ Navigation with theme toggle  
✅ Type-safe throughout  
✅ Error handling  
✅ Responsive design  
✅ Mock data for development  
✅ Production build passing  

**Ready for integration with real TriggerWorkflowManager!**
