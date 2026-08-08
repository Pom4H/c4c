"use client";

/**
 * Execution detail view aligned with useworkflow.dev SDHC model.
 * Shows run status, step chain, telemetry traces, and stream updates.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Clock, AlertTriangle, Pause, StopCircle } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import ExecutionGraph from "@/components/ExecutionGraph";
import WorkflowVisualizer from "@/components/WorkflowVisualizer";
import TraceViewer from "@/components/TraceViewer";
import SpanGanttChart from "@/components/SpanGanttChart";
import type { StepExecution, WorkflowDefinition, WorkflowRun } from "@/lib/useworkflow/types";

const EMPTY_RUN: WorkflowRun | null = null;

export default function ExecutionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const executionId = params.id as string;

  const [run, setRun] = useState<WorkflowRun | null>(EMPTY_RUN);
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>(null);

  useEffect(() => {
    if (!executionId) return;
    loadExecution();

    const eventSource = new EventSource(`/api/workflow/executions/${executionId}/stream`);
    eventSource.onmessage = () => {
      loadExecution(false);
    };
    eventSource.onerror = () => {
      console.warn("Execution SSE stream disconnected, attempting silent reload");
    };

    return () => {
      eventSource.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId]);

  const loadExecution = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      const response = await fetch(`/api/workflow/executions/${executionId}`);
      const runData: WorkflowRun = await response.json();
      setRun(runData);

      if (!workflow || workflow.id !== runData.workflowId) {
        const wfResponse = await fetch(`/api/workflow/definitions/${runData.workflowId}`);
        const wfData: WorkflowDefinition = await wfResponse.json();
        setWorkflow(wfData);
      }

      if (!selectedStepKey && runData.stepExecutions.length > 0) {
        setSelectedStepKey(runData.stepExecutions[0].stepKey);
      }
    } catch (error) {
      console.error("Failed to load execution:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: WorkflowRun["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case "failed":
        return <XCircle className="h-6 w-6 text-red-500" />;
      case "running":
        return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />;
      case "waiting":
        return <Pause className="h-6 w-6 text-amber-500" />;
      case "cancelled":
        return <StopCircle className="h-6 w-6 text-purple-500" />;
      default:
        return <Clock className="h-6 w-6 text-gray-500" />;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  const selectedStep: StepExecution | null = useMemo(() => {
    if (!run || !selectedStepKey) return null;
    return run.stepExecutions.find((step) => step.stepKey === selectedStepKey) ?? null;
  }, [run, selectedStepKey]);

  if (isLoading) {
    return (
      <main className="min-h-screen gradient-workflow p-8">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  if (!run || !workflow) {
    return (
      <main className="min-h-screen gradient-workflow p-8">
        <div className="max-w-7xl mx-auto">
          <Alert variant="destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Execution not found</AlertTitle>
            <AlertDescription>
              Could not find execution with ID: {executionId}
            </AlertDescription>
          </Alert>
          <Button onClick={() => router.push("/executions")} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Executions
          </Button>
        </div>
      </main>
    );
  }

  const completedSteps = run.stepExecutions.filter((step) => step.status === "completed").length;

  return (
    <main className="min-h-screen gradient-workflow p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.push("/executions")}> 
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                  {getStatusIcon(run.status)}
                  {run.workflowName || workflow.name}
                </h1>
                <p className="text-muted-foreground mt-1">
                  Run ID: <code className="text-sm">{run.id}</code>
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "outline"} className="text-base">
                  {run.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Duration</p>
                <p className="text-lg font-semibold font-mono">{formatDuration(run.durationMs)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Steps Completed</p>
                <p className="text-lg font-semibold">
                  {completedSteps} / {run.stepExecutions.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Started</p>
                <p className="text-sm">{new Date(run.startedAt).toLocaleString()}</p>
              </div>
            </div>

            {run.error && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle>{run.error.name || "Run error"}</AlertTitle>
                <AlertDescription>{run.error.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <Card className="h-full">
              <Tabs defaultValue="graph" className="h-full flex flex-col">
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
                  <TabsTrigger value="graph" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                    ?? Graph
                  </TabsTrigger>
                  <TabsTrigger value="visual" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                    ?? Chain
                  </TabsTrigger>
                  <TabsTrigger value="gantt" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                    ?? Timeline
                  </TabsTrigger>
                  <TabsTrigger value="trace" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                    ?? Trace
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="graph" className="flex-1 m-0">
                  <ExecutionGraph
                    workflow={workflow}
                    run={run}
                    onStepClick={setSelectedStepKey}
                  />
                </TabsContent>

                <TabsContent value="visual" className="flex-1 m-0 p-6">
                  <WorkflowVisualizer
                    workflow={workflow}
                    stepExecutions={run.stepExecutions}
                    spans={run.spans}
                  />
                </TabsContent>

                <TabsContent value="gantt" className="flex-1 m-0 p-6">
                  <SpanGanttChart spans={run.spans || []} />
                </TabsContent>

                <TabsContent value="trace" className="flex-1 m-0 p-6">
                  <TraceViewer spans={run.spans || []} />
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          <div>
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>{selectedStep ? "Step Details" : "Select a Step"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedStep ? (
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Step key</p>
                      <p className="font-mono text-xs break-all">{selectedStep.stepKey}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge>{selectedStep.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-muted-foreground">Started</p>
                        <p>{selectedStep.startedAt ? new Date(selectedStep.startedAt).toLocaleString() : "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Finished</p>
                        <p>{selectedStep.finishedAt ? new Date(selectedStep.finishedAt).toLocaleString() : "-"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Duration</p>
                        <p>{formatDuration(selectedStep.durationMs)}</p>
                      </div>
                    </div>
                    <div className="border-t border-border" />
                    {selectedStep.input && (
                      <div>
                        <p className="text-muted-foreground mb-2">Input</p>
                        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                          {JSON.stringify(selectedStep.input, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedStep.output && (
                      <div>
                        <p className="text-muted-foreground mb-2">Output</p>
                        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                          {JSON.stringify(selectedStep.output, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedStep.error && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>{selectedStep.error.name || "Step error"}</AlertTitle>
                        <AlertDescription>{selectedStep.error.message}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Choose a step from the graph to inspect its payloads.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {run.output && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Run Output</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
                {JSON.stringify(run.output, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
