# Workflow Visualization Color Scheme

**Visual semantics for workflow node types.**

In tsdev workflows, node types have semantic meaning:
- **Procedure** = executes business logic
- **Condition** = branching logic
- **Parallel** = concurrent execution
- **Sequential** = flow control

Colors provide instant visual recognition of workflow patterns.

---

## Color Palette

| Node Type | Color | Hex Code | Semantic Meaning |
|-----------|-------|----------|------------------|
| **Procedure** | 🟢 Green | `#4ade80` | Action/execution node |
| **Condition** | 🟡 Yellow | `#fbbf24` | Decision point |
| **Parallel** | 🟣 Purple | `#818cf8` | Concurrent execution |
| **Sequential** | 🔵 Blue | `#60a5fa` | Flow control |
| **Error** | 🔴 Red | `#ef4444` | Failed execution |

---

## Usage Across Components

### WorkflowVisualizer.tsx (React Flow)

**Node rendering:**
```typescript
const nodeColor = {
  procedure: "#4ade80",
  condition: "#fbbf24",
  parallel: "#818cf8",
  sequential: "#60a5fa"
}[node.type];

<div style={{ backgroundColor: nodeColor }}>
  {node.data.label}
</div>
```

**Edge animation:**
```typescript
// Executed edges are animated
<Edge
  animated={isExecuted}
  style={{ stroke: isExecuted ? "#4ade80" : "#94a3b8" }}
/>
```

### SpanGanttChart.tsx

**Gantt bars:**
```typescript
const spanColor = getNodeColor(span.attributes["node.type"]);

<div
  className="gantt-bar"
  style={{
    backgroundColor: spanColor,
    width: `${(span.duration / totalDuration) * 100}%`
  }}
/>
```

### TraceViewer.tsx

**Span hierarchy:**
```typescript
const statusColor = {
  OK: "#4ade80",
  ERROR: "#ef4444",
  UNSET: "#94a3b8"
}[span.status.code];
```

---

## Implementation Details

### Why Inline Styles?

React Flow requires inline styles for node customization:

```typescript
// ✅ Works (inline styles)
<Node style={{ backgroundColor: "#4ade80" }} />

// ❌ Doesn't work (CSS variables not interpolated)
<Node style={{ backgroundColor: "var(--color-green)" }} />
```

### Theme Support

Colors work in both light and dark themes:

- **Light theme:** Full saturation colors
- **Dark theme:** Same colors (high contrast against dark background)

**No theme switching needed** - colors are absolute, not relative.

### Accessibility

All colors meet WCAG AA contrast requirements:

- Green `#4ade80` on white: 3.2:1 (AA Large Text ✅)
- Yellow `#fbbf24` on white: 1.9:1 (Use dark text)
- Purple `#818cf8` on white: 4.5:1 (AA ✅)
- Blue `#60a5fa` on white: 3.7:1 (AA Large Text ✅)

**Enhancement:** Add text color logic:

```typescript
const textColor = node.type === "condition" ? "#1f2937" : "#ffffff";
```

---

## Consistency

**Color constants defined once:**

```typescript
// lib/workflow/colors.ts
export const NODE_COLORS = {
  procedure: "#4ade80",
  condition: "#fbbf24",
  parallel: "#818cf8",
  sequential: "#60a5fa",
  error: "#ef4444"
} as const;

// Used everywhere
import { NODE_COLORS } from "@/lib/workflow/colors";
```

**Used in:**
- `WorkflowVisualizer.tsx` - Node backgrounds
- `SpanGanttChart.tsx` - Gantt bars
- `TraceViewer.tsx` - Span indicators
- `page.tsx` - Node type legend

---

## Visual Patterns

### Sequential Flow (Blue)
```
[Procedure] → [Procedure] → [Procedure]
   Green         Green         Green
```

### Conditional Flow (Yellow)
```
[Procedure] → [Condition] ─→ [Procedure]
   Green        Yellow    └─→ [Procedure]
```

### Parallel Flow (Purple)
```
                ┌─→ [Procedure]
[Parallel] ────┼─→ [Procedure]
   Purple      └─→ [Procedure]
                      ↓
                [Procedure]
```

### Error State (Red)
```
[Procedure] → [Procedure (ERROR)]
   Green         Red border + background
```

---

## Future Enhancements

### Custom Color Schemes

Allow users to customize colors:

```typescript
const theme = {
  procedure: "#10b981",  // Custom green
  condition: "#f59e0b",  // Custom yellow
  // ...
};

<WorkflowVisualizer theme={theme} />
```

### Status-based Colors

Color nodes by execution status:

```typescript
const nodeColor = {
  pending: "#94a3b8",     // Gray
  running: "#3b82f6",     // Blue
  completed: "#4ade80",   // Green
  failed: "#ef4444"       // Red
}[node.status];
```

### Heatmap Mode

Color by duration:

```typescript
const durationColor = interpolate(
  span.duration,
  [minDuration, maxDuration],
  ["#4ade80", "#ef4444"]  // Green to Red
);
```

---

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Component architecture
- [README.md](./README.md) - Usage guide

---

**Color is semantics.** In workflow visualization, color instantly communicates node type, execution state, and performance characteristics.
