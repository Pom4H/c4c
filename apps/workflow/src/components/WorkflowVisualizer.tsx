"use client";

/**
 * Workflow Visualizer using React Flow
 */

import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  TraceSpan,
  WorkflowDefinition,
  StepExecution,
} from "@/lib/useworkflow/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface WorkflowVisualizerProps {
  workflow: WorkflowDefinition;
  stepExecutions?: StepExecution[];
  spans?: TraceSpan[];
}

// Node type colors
const getStatusColor = (status: StepExecution["status"]) => {
  const colors: Record<StepExecution["status"], string> = {
    pending: "#e5e7eb",
    running: "#3b82f6",
    waiting: "#fbbf24",
    completed: "#4ade80",
    failed: "#ef4444",
    cancelled: "#a855f7",
    skipped: "#6b7280",
  };
  return colors[status] ?? "#e5e7eb";
};

export default function WorkflowVisualizer({
  workflow,
  stepExecutions,
  spans,
}: WorkflowVisualizerProps) {
  const spanIndex = useMemo(() => {
    if (!spans) return new Map<string, TraceSpan>();
    const index = new Map<string, TraceSpan>();
    for (const span of spans) {
      const stepKey =
        (span.attributes["step.key"] as string | undefined) ||
        (span.attributes["node.id"] as string | undefined);
      if (stepKey) {
        index.set(stepKey, span);
      }
    }
    return index;
  }, [spans]);

  const statusByStep = useMemo(() => {
    const map = new Map<string, StepExecution["status"]>();
    stepExecutions?.forEach((execution) => {
      map.set(execution.stepKey, execution.status);
    });
    return map;
  }, [stepExecutions]);

  // Convert workflow nodes to React Flow nodes
  const initialNodes = useMemo(() => {
    const nodes: Node[] = [];
    const nodeMap = new Map<string, number>();

    // Calculate positions based on node hierarchy
    workflow.steps.forEach((step, index) => {
      const level = calculateStepLevel(step.key, workflow, nodeMap);
      const position = {
        x: level * 300 + 50,
        y: index * 150 + 50,
      };

      const status = statusByStep.get(step.key) ?? "pending";
      const nodeSpan = spanIndex.get(step.key);

      nodes.push({
        id: step.key,
        type: "default",
        position,
        data: {
          label: (
            <div className="text-center">
              <div className="font-bold">{step.title || step.key}</div>
              <div className="text-xs text-muted-foreground">
                {status}
                {step.hook && (
                  <>
                    <br />
                    {step.hook}
                  </>
                )}
              </div>
              {nodeSpan && (
              <div className="text-xs mt-1 text-primary">
                  {nodeSpan.duration}ms
                </div>
              )}
            </div>
          ),
        },
        style: {
          background: getStatusColor(status),
          border: `2px solid ${nodeSpan && nodeSpan.status.code === "ERROR" ? "#ef4444" : "#1e40af"}`,
          borderRadius: "8px",
          padding: "10px",
          width: 180,
          opacity: status === "pending" ? 0.6 : 1,
          color: status === "pending" ? "#111827" : "#ffffff",
        },
      });
    });

    return nodes;
  }, [workflow, statusByStep, spanIndex]);

  // Convert workflow edges to React Flow edges
  const initialEdges = useMemo(() => {
    const edges: Edge[] = [];

    workflow.steps.forEach((step) => {
      if (step.transitions) {
        step.transitions
          .filter((transition) => transition.to)
          .forEach((transition, index) => {
            const target = transition.to as string;
            const status = statusByStep.get(step.key) ?? "pending";
            const animated = status === "completed" || status === "running";
            edges.push({
              id: `${step.key}-${target}-${index}`,
              source: step.key,
              target,
              animated,
              style: {
                stroke: status === "completed" ? "#4ade80" : "#94a3b8",
                strokeWidth: status === "completed" ? 2 : 1,
              },
              label: transition.label || transition.on || `branch ${index + 1}`,
            });
          });
      }
    });

    return edges;
  }, [workflow, statusByStep]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when execution result changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex gap-4 text-xs flex-wrap">
        {[
          { label: "Completed", color: getStatusColor("completed") },
          { label: "Running", color: getStatusColor("running") },
          { label: "Waiting", color: getStatusColor("waiting") },
          { label: "Pending", color: getStatusColor("pending") },
          { label: "Failed", color: getStatusColor("failed") },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ background: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      
      <div style={{ width: "100%", height: "600px" }}>
        <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const status = statusByStep.get(node.id) ?? "pending";
            return getStatusColor(status);
          }}
        />
        <Panel position="top-left">
          <Card className="min-w-[250px]">
            <CardHeader className="p-4">
              <CardTitle className="text-base">{workflow.name}</CardTitle>
              <CardDescription className="text-xs">
                {workflow.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex gap-2 text-xs">
                <Badge variant="secondary">v{workflow.version}</Badge>
                <Badge variant="outline">{workflow.steps.length} steps</Badge>
              </div>
            </CardContent>
          </Card>
        </Panel>
        {stepExecutions && (
          <Panel position="top-right">
            <Card className="min-w-[200px]">
              <CardHeader className="p-4">
                <CardTitle className="text-base">Execution Stats</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Completed:</span>
                  <Badge variant="default">
                    {stepExecutions.filter((step) => step.status === "completed").length}
                  </Badge>
                </div>
                {spans && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Spans:</span>
                    <Badge variant="default">{spans.length}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </Panel>
        )}
      </ReactFlow>
      </div>
    </div>
  );
}

function calculateStepLevel(
  stepKey: string,
  workflow: WorkflowDefinition,
  cache: Map<string, number>
): number {
  if (cache.has(stepKey)) {
    return cache.get(stepKey)!;
  }

  if (stepKey === workflow.entryStep) {
    cache.set(stepKey, 0);
    return 0;
  }

  const parents = workflow.steps.filter((step) =>
    step.transitions?.some((transition) => transition.to === stepKey)
  );

  if (parents.length === 0) {
    cache.set(stepKey, 0);
    return 0;
  }

  const maxParentLevel = Math.max(
    ...parents.map((parent) => calculateStepLevel(parent.key, workflow, cache))
  );
  const level = maxParentLevel + 1;
  cache.set(stepKey, level);
  return level;
}
