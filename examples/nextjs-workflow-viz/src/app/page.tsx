"use client";

/**
 * Main page component for Workflow Visualization
 */

import { useState, useEffect } from "react";
import WorkflowVisualizer from "@/components/WorkflowVisualizer";
import TraceViewer from "@/components/TraceViewer";
import SpanGanttChart from "@/components/SpanGanttChart";
import {
  executeWorkflowAction,
  getAvailableWorkflows,
  getWorkflowDefinition,
} from "./actions";
import type {
  WorkflowDefinition,
  WorkflowExecutionResult,
} from "@/lib/workflow/types";

export default function Home() {
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string; nodeCount: number }>>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [selectedWorkflow, setSelectedWorkflow] =
    useState<WorkflowDefinition | null>(null);
  const [executionResult, setExecutionResult] =
    useState<WorkflowExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState<"graph" | "trace" | "gantt">("graph");

  // Load available workflows on mount
  useEffect(() => {
    getAvailableWorkflows().then((wfs) => {
      setWorkflows(wfs);
      if (wfs.length > 0) {
        setSelectedWorkflowId(wfs[0].id);
      }
    });
  }, []);

  // Load workflow definition when selection changes
  useEffect(() => {
    if (selectedWorkflowId) {
      getWorkflowDefinition(selectedWorkflowId).then((wf) => {
        setSelectedWorkflow(wf);
        setExecutionResult(null); // Clear previous execution
      });
    }
  }, [selectedWorkflowId]);

  const handleExecute = async () => {
    if (!selectedWorkflowId) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const result = await executeWorkflowAction(selectedWorkflowId);
      setExecutionResult(result);
      setActiveTab("graph"); // Switch to graph view to see execution
    } catch (error) {
      console.error("Workflow execution failed:", error);
      alert(
        `Execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <main className="min-h-screen gradient-workflow p-8">
      <div className="max-w-7xl mx-auto animate-slide-in">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            🔄 Workflow Visualization with OpenTelemetry
          </h1>
          <p className="text-muted-foreground">
            Next.js 15 + Server Actions + React Flow + OpenTelemetry Protocol
          </p>
        </div>

        {/* Controls */}
        <div className="workflow-card p-6 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <label
                htmlFor="workflow-select"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Select Workflow
              </label>
              <select
                id="workflow-select"
                value={selectedWorkflowId}
                onChange={(e) => setSelectedWorkflowId(e.target.value)}
                className="workflow-input w-full"
                disabled={isExecuting}
              >
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>
                    {wf.name} ({wf.nodeCount} nodes)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-shrink-0">
              <button
                onClick={handleExecute}
                disabled={!selectedWorkflowId || isExecuting}
                className="workflow-button-primary disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {isExecuting ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Executing...
                  </span>
                ) : (
                  "▶ Execute Workflow"
                )}
              </button>
            </div>
          </div>

          {/* Execution status */}
          {executionResult && (
            <div
              className={`mt-4 p-4 rounded-lg border ${
                executionResult.status === "completed"
                  ? "bg-[var(--workflow-success)]/10 border-[var(--workflow-success)]"
                  : "bg-[var(--workflow-error)]/10 border-[var(--workflow-error)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-2xl ${
                    executionResult.status === "completed" ? "text-[var(--workflow-success)]" : "text-[var(--workflow-error)]"
                  }`}
                >
                  {executionResult.status === "completed" ? "✓" : "✗"}
                </span>
                <div>
                  <div className="font-semibold text-foreground">
                    Execution {executionResult.status}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Duration: {executionResult.executionTime}ms | Nodes
                    executed: {executionResult.nodesExecuted.length} | Spans
                    collected: {executionResult.spans.length}
                  </div>
                  {executionResult.error && (
                    <div className="text-sm text-destructive mt-1">
                      Error: {executionResult.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="workflow-card overflow-hidden">
          <div className="border-b border-border">
            <nav className="flex">
              <button
                onClick={() => setActiveTab("graph")}
                className={`workflow-tab ${
                  activeTab === "graph" ? "workflow-tab-active" : ""
                }`}
              >
                📊 Workflow Graph
              </button>
              <button
                onClick={() => setActiveTab("gantt")}
                className={`workflow-tab ${
                  activeTab === "gantt" ? "workflow-tab-active" : ""
                }`}
              >
                📈 Span Gantt Chart
              </button>
              <button
                onClick={() => setActiveTab("trace")}
                className={`workflow-tab ${
                  activeTab === "trace" ? "workflow-tab-active" : ""
                }`}
              >
                🔍 Trace Details
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "graph" && selectedWorkflow && (
              <WorkflowVisualizer
                workflow={selectedWorkflow}
                executionResult={
                  executionResult
                    ? {
                        nodesExecuted: executionResult.nodesExecuted,
                        spans: executionResult.spans,
                      }
                    : undefined
                }
              />
            )}

            {activeTab === "gantt" && (
              <SpanGanttChart spans={executionResult?.spans || []} />
            )}

            {activeTab === "trace" && (
              <TraceViewer spans={executionResult?.spans || []} />
            )}
          </div>
        </div>

        {/* Workflow Details */}
        {selectedWorkflow && (
          <div className="mt-6 workflow-card p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">Workflow Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">Information</h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">ID:</dt>
                    <dd className="font-mono">{selectedWorkflow.id}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Version:</dt>
                    <dd>{selectedWorkflow.version}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Start Node:</dt>
                    <dd className="font-mono">{selectedWorkflow.startNode}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Total Nodes:</dt>
                    <dd>{selectedWorkflow.nodes.length}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Node Types</h3>
                <div className="space-y-2">
                  {Object.entries(
                    selectedWorkflow.nodes.reduce(
                      (acc, node) => {
                        acc[node.type] = (acc[node.type] || 0) + 1;
                        return acc;
                      },
                      {} as Record<string, number>
                    )
                  ).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{
                          background:
                            type === "procedure"
                              ? "#4ade80"
                              : type === "condition"
                                ? "#fbbf24"
                                : type === "parallel"
                                  ? "#818cf8"
                                  : "#60a5fa",
                        }}
                      />
                      <span className="text-sm">
                        {type}: {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Node list */}
            <div className="mt-6">
              <h3 className="font-semibold text-lg mb-2">All Nodes</h3>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left">ID</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Procedure</th>
                      <th className="px-4 py-2 text-left">Next</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedWorkflow.nodes.map((node) => (
                      <tr key={node.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-2 font-mono text-foreground">{node.id}</td>
                        <td className="px-4 py-2 text-foreground">{node.type}</td>
                        <td className="px-4 py-2 font-mono text-primary">
                          {node.procedureName || "-"}
                        </td>
                        <td className="px-4 py-2 font-mono text-muted-foreground">
                          {node.next
                            ? Array.isArray(node.next)
                              ? node.next.join(", ")
                              : node.next
                            : "end"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-muted-foreground text-sm">
          <p>
            Built with Next.js 15, React Flow, and OpenTelemetry Protocol
          </p>
          <p className="mt-1">
            Server Actions execute workflows and collect traces for
            visualization
          </p>
        </div>
      </div>
    </main>
  );
}
