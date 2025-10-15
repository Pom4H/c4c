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
import type { WorkflowDefinition, TraceSpan } from "@tsdev/workflow";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface WorkflowVisualizerProps {
  workflow: WorkflowDefinition;
  executionResult?: {
    nodesExecuted: string[];
    spans: TraceSpan[];
  };
}

const nodeTypeColors = {
  procedure: "hsl(var(--span-procedure))",
  condition: "hsl(var(--span-condition))",
  parallel: "hsl(var(--span-parallel))",
  sequential: "hsl(var(--span-sequential))",
} as const;

export default function WorkflowVisualizer({
  workflow,
  executionResult,
}: WorkflowVisualizerProps) {
  // Convert workflow nodes to React Flow nodes
  const initialNodes = useMemo(() => {
    const nodes: Node[] = [];
    const nodeMap = new Map<string, number>();

    // Calculate positions based on node hierarchy
    workflow.nodes.forEach((node, index) => {
      const level = calculateNodeLevel(node.id, workflow, nodeMap);
      const position = {
        x: level * 300 + 50,
        y: index * 150 + 50,
      };

      const isExecuted = executionResult?.nodesExecuted.includes(node.id);
      const nodeSpan = executionResult?.spans.find(
        (s) => s.attributes["node.id"] === node.id
      );

      nodes.push({
        id: node.id,
        type: "default",
        position,
        data: {
          label: (
            <div className="text-center">
              <div className="font-bold">{node.id}</div>
              <div className="text-xs text-muted-foreground">
                {node.type}
                {node.procedureName && (
                  <>
                    <br />
                    {node.procedureName}
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
          background: isExecuted
            ? nodeTypeColors[node.type as keyof typeof nodeTypeColors] || "hsl(var(--primary))"
            : "hsl(var(--muted))",
          border: `2px solid ${nodeSpan?.status.code === "ERROR" ? "hsl(var(--destructive))" : "hsl(var(--primary))"}`,
          borderRadius: "8px",
          padding: "10px",
          width: 180,
          opacity: isExecuted ? 1 : 0.5,
          color: isExecuted ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
        },
      });
    });

    return nodes;
  }, [workflow, executionResult]);

  // Convert workflow edges to React Flow edges
  const initialEdges = useMemo(() => {
    const edges: Edge[] = [];

    workflow.nodes.forEach((node) => {
      if (node.next) {
        const nextNodes = Array.isArray(node.next) ? node.next : [node.next];
        nextNodes.forEach((nextId, index) => {
          edges.push({
            id: `${node.id}-${nextId}`,
            source: node.id,
            target: nextId,
            animated: executionResult?.nodesExecuted.includes(node.id) ?? false,
            style: {
              stroke: executionResult?.nodesExecuted.includes(node.id)
                ? "hsl(var(--span-procedure))"
                : "hsl(var(--muted-foreground))",
              strokeWidth: 2,
            },
            label: Array.isArray(node.next) ? `branch ${index + 1}` : undefined,
          });
        });
      }

      // Add conditional branches
      if (node.type === "condition" && node.config) {
        const config = node.config as { trueBranch?: string; falseBranch?: string };
        if (config.trueBranch) {
          edges.push({
            id: `${node.id}-true-${config.trueBranch}`,
            source: node.id,
            target: config.trueBranch,
            animated: executionResult?.nodesExecuted.includes(node.id) ?? false,
            style: {
              stroke: "hsl(var(--span-procedure))",
              strokeWidth: 2,
            },
            label: "✓ true",
          });
        }
        if (config.falseBranch) {
          edges.push({
            id: `${node.id}-false-${config.falseBranch}`,
            source: node.id,
            target: config.falseBranch,
            animated: false,
            style: {
              stroke: "hsl(var(--destructive))",
              strokeWidth: 2,
            },
            label: "✗ false",
          });
        }
      }

      // Add parallel branches
      if (node.type === "parallel" && node.config) {
        const config = node.config as { branches?: string[] };
        if (config.branches) {
          config.branches.forEach((branchId: string, index: number) => {
            edges.push({
              id: `${node.id}-branch-${branchId}`,
              source: node.id,
              target: branchId,
              animated:
                executionResult?.nodesExecuted.includes(node.id) ?? false,
              style: {
                stroke: "hsl(var(--span-parallel))",
                strokeWidth: 2,
              },
              label: `parallel ${index + 1}`,
            });
          });
        }
      }
    });

    return edges;
  }, [workflow, executionResult]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when execution result changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
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
            const isExecuted = executionResult?.nodesExecuted.includes(node.id);
            return isExecuted ? "hsl(var(--span-procedure))" : "hsl(var(--muted))";
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
                <Badge variant="outline">{workflow.nodes.length} nodes</Badge>
              </div>
            </CardContent>
          </Card>
        </Panel>
        {executionResult && (
          <Panel position="top-right">
            <Card className="min-w-[200px]">
              <CardHeader className="p-4">
                <CardTitle className="text-base">Execution Stats</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nodes:</span>
                  <Badge variant="default">{executionResult.nodesExecuted.length}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Spans:</span>
                  <Badge variant="default">{executionResult.spans.length}</Badge>
                </div>
              </CardContent>
            </Card>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

function calculateNodeLevel(
  nodeId: string,
  workflow: WorkflowDefinition,
  cache: Map<string, number>
): number {
  if (cache.has(nodeId)) {
    return cache.get(nodeId)!;
  }

  if (nodeId === workflow.startNode) {
    cache.set(nodeId, 0);
    return 0;
  }

  // Find parent nodes
  const parents = workflow.nodes.filter((n) => {
    if (!n.next) return false;
    const nextNodes = Array.isArray(n.next) ? n.next : [n.next];
    return nextNodes.includes(nodeId);
  });

  if (parents.length === 0) {
    cache.set(nodeId, 0);
    return 0;
  }

  const maxParentLevel = Math.max(
    ...parents.map((p) => calculateNodeLevel(p.id, workflow, cache))
  );
  const level = maxParentLevel + 1;
  cache.set(nodeId, level);
  return level;
}
