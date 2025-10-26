"use client";

import { usePausedWorkflows } from "@c4c/workflow-react";
import type { PausedWorkflow } from "@c4c/workflow-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

export function PausedWorkflows() {
  const { pausedWorkflows, isLoading, error, refresh, resume, cancel } = usePausedWorkflows({
    autoRefresh: true,
    refreshInterval: 5000,
  });

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<Record<string, string>>({});

  const formatTimeAgo = (timestamp: Date | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatTimeout = (timeoutAt?: Date | string) => {
    if (!timeoutAt) return null;
    
    const date = typeof timeoutAt === 'string' ? new Date(timeoutAt) : timeoutAt;
    const seconds = Math.floor((date.getTime() - Date.now()) / 1000);
    
    if (seconds < 0) return <Badge variant="destructive">Expired</Badge>;
    if (seconds < 3600) return <Badge variant="destructive">{Math.floor(seconds / 60)}m remaining</Badge>;
    if (seconds < 86400) return <Badge variant="secondary">{Math.floor(seconds / 3600)}h remaining</Badge>;
    return <Badge variant="outline">{Math.floor(seconds / 86400)}d remaining</Badge>;
  };

  const handleResume = async (executionId: string) => {
    try {
      const data = resumeData[executionId] ? JSON.parse(resumeData[executionId]) : {};
      await resume(executionId, data);
      setResumeData((prev) => {
        const next = { ...prev };
        delete next[executionId];
        return next;
      });
      setExpandedRow(null);
    } catch (err) {
      console.error("Failed to resume workflow:", err);
      alert(`Failed to resume: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCancel = async (executionId: string) => {
    if (!confirm("Are you sure you want to cancel this workflow?")) {
      return;
    }
    
    try {
      await cancel(executionId);
      setExpandedRow(null);
    } catch (err) {
      console.error("Failed to cancel workflow:", err);
      alert(`Failed to cancel: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">{error.message}</p>
          <Button onClick={refresh} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Paused Workflows</CardTitle>
              <CardDescription>
                Workflows waiting for external events or human approval
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {pausedWorkflows.length} paused
              </Badge>
              <Button onClick={refresh} variant="outline" size="sm" disabled={isLoading}>
                {isLoading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pausedWorkflows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No paused workflows</p>
              <p className="text-sm mt-2">All workflows are running or completed</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Execution ID</TableHead>
                  <TableHead>Paused At</TableHead>
                  <TableHead>Waiting For</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Timeout</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pausedWorkflows.map((workflow) => (
                  <>
                    <TableRow key={workflow.executionId}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold">{workflow.workflowName || workflow.workflowId}</div>
                          <div className="text-xs text-muted-foreground">{workflow.workflowId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {workflow.executionId.slice(0, 16)}...
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{workflow.pausedAt}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {workflow.waitingFor.map((trigger) => (
                            <Badge key={trigger} variant="secondary" className="text-xs">
                              {trigger}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatTimeAgo(workflow.pausedTime)}
                        </span>
                      </TableCell>
                      <TableCell>{formatTimeout(workflow.timeoutAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setExpandedRow(
                                expandedRow === workflow.executionId ? null : workflow.executionId
                              )
                            }
                          >
                            {expandedRow === workflow.executionId ? "Hide" : "Details"}
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleResume(workflow.executionId)}
                          >
                            Resume
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancel(workflow.executionId)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRow === workflow.executionId && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/50">
                          <div className="p-4 space-y-4">
                            <div>
                              <h4 className="font-semibold mb-2">Variables</h4>
                              <pre className="bg-background p-3 rounded text-xs overflow-auto max-h-40">
                                {JSON.stringify(workflow.variables, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">Resume Data (JSON)</h4>
                              <textarea
                                className="w-full p-3 bg-background rounded font-mono text-xs"
                                rows={6}
                                placeholder='{"approved": true, "comment": "Verified"}'
                                value={resumeData[workflow.executionId] || ""}
                                onChange={(e) =>
                                  setResumeData((prev) => ({
                                    ...prev,
                                    [workflow.executionId]: e.target.value,
                                  }))
                                }
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Enter JSON data to pass when resuming the workflow
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What are Paused Workflows?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Paused workflows are executions that have reached an <code>await</code> node and are waiting for:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Human approval</strong> - Manager needs to approve high-risk orders</li>
            <li><strong>External webhooks</strong> - Payment confirmation, delivery updates</li>
            <li><strong>Internal triggers</strong> - Completion of another procedure</li>
          </ul>
          <p className="mt-4">
            Click <strong>Resume</strong> to continue the workflow with custom data, or <strong>Cancel</strong> to terminate it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
