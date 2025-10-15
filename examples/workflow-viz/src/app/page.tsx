"use client";

/**
 * Main page component for Workflow Visualization
 * 
 * Pure UI component - all logic handled by framework hooks and API routes
 */

import { useState, useEffect } from "react";
import WorkflowVisualizer from "@/components/WorkflowVisualizer";
import TraceViewer from "@/components/TraceViewer";
import SpanGanttChart from "@/components/SpanGanttChart";
import ThemeToggle from "@/components/ThemeToggle";
import { useWorkflow } from "@tsdev/workflow-react";
import { useWorkflows, useWorkflowDefinition } from "@tsdev/workflow-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Loader2, Play } from "lucide-react";

export default function Home() {
	const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
	const [activeTab, setActiveTab] = useState<"graph" | "trace" | "gantt">("graph");

	// Use framework hooks for workflow management
	const { workflows, fetchWorkflows } = useWorkflows();
	const { definition, fetchDefinition } = useWorkflowDefinition(selectedWorkflowId);
	const { execute, result, isExecuting, error } = useWorkflow({
		onSuccess: () => setActiveTab("graph"),
	});

	// Load available workflows on mount
	useEffect(() => {
		fetchWorkflows();
	}, [fetchWorkflows]);

	// Set initial workflow selection
	useEffect(() => {
		if (workflows.length > 0 && !selectedWorkflowId) {
			setSelectedWorkflowId(workflows[0].id);
		}
	}, [workflows, selectedWorkflowId]);

	// Load workflow definition when selection changes
	useEffect(() => {
		if (selectedWorkflowId) {
			fetchDefinition();
		}
	}, [selectedWorkflowId, fetchDefinition]);

	const handleExecute = async () => {
		if (!selectedWorkflowId) return;
		try {
			await execute(selectedWorkflowId);
		} catch (err) {
			console.error("Workflow execution failed:", err);
		}
	};

	return (
		<main className="min-h-screen gradient-workflow p-8">
			<div className="max-w-7xl mx-auto animate-slide-in">
				{/* Header */}
				<div className="mb-8">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-4xl font-bold text-foreground mb-2">
								🔄 Workflow Visualization with OpenTelemetry
							</h1>
							<p className="text-muted-foreground">
								Next.js 15 + React Flow + Framework OTEL Integration
							</p>
						</div>
						<ThemeToggle />
					</div>
				</div>

				{/* Controls */}
				<Card className="mb-6">
					<CardContent className="p-6">
						<div className="flex items-center gap-4 flex-wrap">
							<div className="flex-1 min-w-[300px]">
								<label
									htmlFor="workflow-select"
									className="block text-sm font-medium text-foreground mb-2"
								>
									Select Workflow
								</label>
								<Select
									value={selectedWorkflowId}
									onValueChange={setSelectedWorkflowId}
									disabled={isExecuting}
								>
									<SelectTrigger id="workflow-select">
										<SelectValue placeholder="Select a workflow" />
									</SelectTrigger>
									<SelectContent>
										{workflows.map((wf) => (
											<SelectItem key={wf.id} value={wf.id}>
												{wf.name} ({wf.nodeCount} nodes)
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="flex-shrink-0">
								<Button
									onClick={handleExecute}
									disabled={!selectedWorkflowId || isExecuting}
									className="mt-6"
									size="lg"
								>
									{isExecuting ? (
										<>
											<Loader2 className="mr-2 h-5 w-5 animate-spin" />
											Executing...
										</>
									) : (
										<>
											<Play className="mr-2 h-5 w-5" />
											Execute Workflow
										</>
									)}
								</Button>
							</div>
						</div>

						{/* Execution status */}
						{result && (
							<Alert
								className="mt-4"
								variant={result.status === "completed" ? "default" : "destructive"}
							>
								{result.status === "completed" ? (
									<CheckCircle2 className="h-5 w-5" />
								) : (
									<XCircle className="h-5 w-5" />
								)}
								<AlertTitle>
									Execution {result.status}
								</AlertTitle>
								<AlertDescription>
									<div className="text-sm mt-1">
										Duration: {result.executionTime}ms | Nodes executed:{" "}
										{result.nodesExecuted.length} | Spans collected:{" "}
										{result.spans?.length || 0}
									</div>
									{result.error && (
										<div className="text-sm mt-2">
											Error: {result.error.message || String(result.error)}
										</div>
									)}
								</AlertDescription>
							</Alert>
						)}

						{/* Error display */}
						{error && !result && (
							<Alert variant="destructive" className="mt-4">
								<XCircle className="h-5 w-5" />
								<AlertTitle>Error</AlertTitle>
								<AlertDescription>
									{error.message}
								</AlertDescription>
							</Alert>
						)}
					</CardContent>
				</Card>

				{/* Tabs */}
				<Card>
					<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
						<TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
							<TabsTrigger
								value="graph"
								className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
							>
								📊 Workflow Graph
							</TabsTrigger>
							<TabsTrigger
								value="gantt"
								className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
							>
								📈 Span Gantt Chart
							</TabsTrigger>
							<TabsTrigger
								value="trace"
								className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
							>
								🔍 Trace Details
							</TabsTrigger>
						</TabsList>

						<CardContent className="p-6">
							<TabsContent value="graph" className="m-0">
								{definition && (
									<WorkflowVisualizer
										workflow={definition}
										executionResult={
											result
												? {
														nodesExecuted: result.nodesExecuted,
														spans: result.spans || [],
												  }
												: undefined
										}
									/>
								)}
							</TabsContent>

							<TabsContent value="gantt" className="m-0">
								<SpanGanttChart spans={result?.spans || []} />
							</TabsContent>

							<TabsContent value="trace" className="m-0">
								<TraceViewer spans={result?.spans || []} />
							</TabsContent>
						</CardContent>
					</Tabs>
				</Card>

				{/* Workflow Details */}
				{definition && (
					<Card className="mt-6">
						<CardHeader>
							<CardTitle>Workflow Details</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
									<h3 className="font-semibold text-lg mb-2">Information</h3>
									<dl className="space-y-2 text-sm">
										<div>
											<dt className="text-muted-foreground">ID:</dt>
											<dd className="font-mono">{definition.id}</dd>
										</div>
										<div>
											<dt className="text-muted-foreground">Version:</dt>
											<dd>{definition.version}</dd>
										</div>
										<div>
											<dt className="text-muted-foreground">Start Node:</dt>
											<dd className="font-mono">{definition.startNode}</dd>
										</div>
										<div>
											<dt className="text-muted-foreground">Total Nodes:</dt>
											<dd>{definition.nodes.length}</dd>
										</div>
									</dl>
								</div>

								<div>
									<h3 className="font-semibold text-lg mb-2">Node Types</h3>
									<div className="space-y-2">
										{Object.entries(
											definition.nodes.reduce(
												(acc: Record<string, number>, node: { type: string }) => {
													acc[node.type] = (acc[node.type] || 0) + 1;
													return acc;
												},
												{} as Record<string, number>
											)
										).map(([type, count]) => {
											const colorMap = {
												procedure: "#4ade80",
												condition: "#fbbf24",
												parallel: "#818cf8",
												sequential: "#60a5fa",
											} as const;
											const color = colorMap[type as keyof typeof colorMap] || "#60a5fa";
											
											return (
												<div key={type} className="flex items-center gap-2">
													<div
														className="w-4 h-4 rounded"
														style={{ background: color }}
													/>
													<span className="text-sm">
														{type}: {count as number}
													</span>
												</div>
											);
										})}
									</div>
								</div>
							</div>

							{/* Node list */}
							<div className="mt-6">
								<h3 className="font-semibold text-lg mb-2">All Nodes</h3>
								<div className="overflow-x-auto scrollbar-thin rounded-md border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>ID</TableHead>
												<TableHead>Type</TableHead>
												<TableHead>Procedure</TableHead>
												<TableHead>Next</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{definition.nodes.map((node: { id: string; type: string; procedureName?: string; next?: string | string[] }) => (
												<TableRow key={node.id}>
													<TableCell className="font-mono">{node.id}</TableCell>
													<TableCell>
														<Badge variant="outline">{node.type}</Badge>
													</TableCell>
													<TableCell className="font-mono text-primary">
														{node.procedureName || "-"}
													</TableCell>
													<TableCell className="font-mono text-muted-foreground">
														{node.next
															? Array.isArray(node.next)
																? node.next.join(", ")
																: node.next
															: "end"}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Footer */}
				<div className="mt-8 text-center text-muted-foreground text-sm">
					<p>Built with Next.js 15, React Flow, and tsdev Framework</p>
					<p className="mt-1">
						All workflow execution and OTEL tracing handled by the framework
					</p>
				</div>
			</div>
		</main>
	);
}
