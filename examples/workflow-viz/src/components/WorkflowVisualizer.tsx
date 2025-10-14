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
import type { WorkflowDefinition, TraceSpan } from "@/lib/workflow/types";

interface WorkflowVisualizerProps {
  workflow: WorkflowDefinition;
  executionResult?: {
    nodesExecuted: string[];
    spans: TraceSpan[];
  };
}

const nodeColors = {
  procedure: "#4ade80",
  condition: "#fbbf24",
  parallel: "#818cf8",
  sequential: "#60a5fa",
};

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
              <div className="text-xs text-gray-600">
                {node.type}
                {node.procedureName && (
                  <>
                    <br />
                    {node.procedureName}
                  </>
                )}
              </div>
              {nodeSpan && (
                <div className="text-xs mt-1 text-blue-600">
                  {nodeSpan.duration}ms
                </div>
              )}
            </div>
          ),
        },
        style: {
          background: isExecuted
            ? nodeColors[node.type] || "#60a5fa"
            : "#e5e7eb",
          border: `2px solid ${nodeSpan?.status.code === "ERROR" ? "#ef4444" : "#1e40af"}`,
          borderRadius: "8px",
          padding: "10px",
          width: 180,
          opacity: isExecuted ? 1 : 0.5,
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
                ? "#4ade80"
                : "#94a3b8",
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
              stroke: "#22c55e",
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
              stroke: "#ef4444",
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
                stroke: "#818cf8",
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
            return isExecuted ? "#4ade80" : "#e5e7eb";
          }}
        />
        <Panel position="top-left">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <h3 className="font-bold text-lg mb-2">{workflow.name}</h3>
            <p className="text-sm text-gray-600">{workflow.description}</p>
            <div className="mt-2 text-xs text-gray-500">
              Version: {workflow.version} | Nodes: {workflow.nodes.length}
            </div>
          </div>
        </Panel>
        {executionResult && (
          <Panel position="top-right">
            <div className="bg-white p-4 rounded-lg shadow-lg max-w-xs">
              <h4 className="font-bold mb-2">Execution Stats</h4>
              <div className="text-sm space-y-1">
                <div>
                  Nodes executed:{" "}
                  <span className="font-semibold">
                    {executionResult.nodesExecuted.length}
                  </span>
                </div>
                <div>
                  Spans collected:{" "}
                  <span className="font-semibold">
                    {executionResult.spans.length}
                  </span>
                </div>
              </div>
            </div>
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
