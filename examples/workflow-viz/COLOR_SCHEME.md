# Workflow Visualization Color Scheme

## Node Type Colors

Consistent colors used across all components (React Flow, Gantt Chart, Legends):

| Node Type    | Color   | Hex Code  | Usage                                    |
|--------------|---------|-----------|------------------------------------------|
| **Procedure**   | 🟢 Green  | `#4ade80` | Standard workflow procedure nodes        |
| **Condition**   | 🟡 Yellow | `#fbbf24` | Conditional branching nodes              |
| **Parallel**    | 🟣 Purple | `#818cf8` | Parallel execution nodes                 |
| **Sequential**  | 🔵 Blue   | `#60a5fa` | Sequential flow nodes (default)          |
| **Error**       | 🔴 Red    | `#ef4444` | Nodes or spans with errors               |

## Components Using These Colors

### 1. WorkflowVisualizer.tsx
- React Flow node backgrounds
- Edge colors based on execution state
- MiniMap coloring
- Legend display

### 2. SpanGanttChart.tsx
- Gantt chart bar colors
- Legend badges
- Span type indicators

### 3. page.tsx
- Node type statistics display
- Color indicators in workflow details

## Theme Support

All components work correctly in both **light** and **dark** themes:
- Colors are applied via inline styles for React Flow compatibility
- shadcn UI components handle theme switching automatically
- CSS variables defined in `globals.css` for workflow-specific colors

## Implementation Note

Direct hex colors are used instead of CSS variables in React Flow components because:
1. React Flow requires inline styles for node/edge styling
2. CSS variable interpolation doesn't work in inline styles
3. Ensures consistent rendering regardless of theme switching timing
