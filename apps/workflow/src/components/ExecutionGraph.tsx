"use client";

/**
 * Execution Graph - displays workflow graph with node statuses
 * Like in n8n - colored nodes show execution status
 */

import { useCallback, useMemo, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  StepExecution,
  WorkflowDefinition,
  WorkflowRun,
} from "@/lib/useworkflow/types";

interface ExecutionGraphProps {
  workflow: WorkflowDefinition;
  run: WorkflowRun;
  onStepClick?: (stepKey: string) => void;
}

const STATUS_COLORS: Record<StepExecution["status"], { bg: string; border: string; text: string }> = {
  pending: { bg: "#e5e7eb", border: "#d1d5db", text: "#374151" },
  running: { bg: "#3b82f6", border: "#2563eb", text: "#ffffff" },
  waiting: { bg: "#fbbf24", border: "#d97706", text: "#1f2937" },
  completed: { bg: "#10b981", border: "#059669", text: "#ffffff" },
  failed: { bg: "#ef4444", border: "#dc2626", text: "#ffffff" },
  cancelled: { bg: "#a855f7", border: "#6d28d9", text: "#ffffff" },
  skipped: { bg: "#6b7280", border: "#4b5563", text: "#e5e7eb" },
};

export default function ExecutionGraph({ workflow, run, onStepClick }: ExecutionGraphProps) {
  const stepMap = useMemo(() => new Map(run.stepExecutions.map((step) => [step.stepKey, step])), [run.stepExecutions]);

  const initialNodes: Node[] = useMemo(() => {
    return workflow.steps.map((step, index) => {
      const execution = stepMap.get(step.key);
      const status = execution?.status ?? "pending";
      const colors = STATUS_COLORS[status];
      const executed = status !== "pending" && status !== "waiting";

      return {
        id: step.key,
        type: "default",
        position: {
          x: 100 + (index % 3) * 300,
          y: 100 + Math.floor(index / 3) * 150,
        },
        data: {
          label: (
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🔗</span>
                <span className="font-semibold">{step.title || step.key}</span>
              </div>
              <div className="text-xs opacity-90">{status}</div>
              {step.hook && (
                <div className="text-xs opacity-75 mt-1 font-mono truncate max-w-[200px]">
                  {step.hook}
                </div>
              )}
              {execution?.durationMs !== undefined && (
                <div className="text-xs font-semibold mt-1">
                  {execution.durationMs < 1000
                    ? `${execution.durationMs}ms`
                    : `${(execution.durationMs / 1000).toFixed(2)}s`}
                </div>
              )}
            </div>
          ),
        },
        style: {
          background: colors.bg,
          border: `2px solid ${colors.border}`,
          borderRadius: "8px",
          color: colors.text,
          opacity: executed ? 1 : 0.6,
          boxShadow: status === "running" ? "0 0 0 3px rgba(59, 130, 246, 0.3)" : undefined,
        },
      };
    });
  }, [workflow, stepMap]);

  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];

    workflow.steps.forEach((step) => {
      step.transitions
        ?.filter((transition) => transition.to)
        .forEach((transition, index) => {
          const target = transition.to as string;
          const status = stepMap.get(step.key)?.status ?? "pending";
          const wasTraversed = status === "completed" || status === "running";

          edges.push({
            id: `${step.key}-${target}-${index}`,
            source: step.key,
            target,
            type: "smoothstep",
            animated: wasTraversed,
            style: {
              stroke: wasTraversed ? "#10b981" : "#d1d5db",
              strokeWidth: wasTraversed ? 2 : 1,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: wasTraversed ? "#10b981" : "#d1d5db",
            },
            label: transition.label || transition.on || `branch ${index + 1}`,
          });
        });
    });

    return edges;
  }, [workflow, stepMap]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onStepClick?.(node.id);
    },
    [onStepClick],
  );

  return (
    <div className="w-full h-[600px] bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-card border rounded-lg p-3 shadow-lg text-sm">
        <div className="font-semibold mb-2">Status Legend</div>
        <div className="space-y-1">
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <div key={status} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: colors.bg }} />
              <span className="capitalize">{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
