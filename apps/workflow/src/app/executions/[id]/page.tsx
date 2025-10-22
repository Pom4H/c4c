"use client";

/**
 * Execution Detail Page - как в n8n
 * Показывает детали выполнения с графом и статусами нод
 */

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Clock, AlertTriangle } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import ExecutionGraph from "@/components/ExecutionGraph";
import TraceViewer from "@/components/TraceViewer";
import SpanGanttChart from "@/components/SpanGanttChart";

interface NodeDetail {
	nodeId: string;
	status: "pending" | "running" | "completed" | "failed" | "skipped";
	startTime?: string;
	endTime?: string;
	duration?: number;
	input?: Record<string, unknown>;
	output?: unknown;
	error?: {
		message: string;
		name: string;
	};
}

interface ExecutionDetail {
	executionId: string;
	workflowId: string;
	workflowName: string;
	status: "completed" | "failed" | "cancelled" | "running";
	startTime: string;
	endTime?: string;
	executionTime?: number;
	nodesExecuted: string[];
	nodeDetails: Record<string, NodeDetail>;
	outputs: Record<string, unknown>;
	error?: {
		message: string;
		name: string;
		stack?: string;
	};
	spans?: Array<{
		spanId: string;
		traceId: string;
		parentSpanId?: string;
		name: string;
		kind: string;
		startTime: number;
		endTime: number;
		duration: number;
		status: { code: "OK" | "ERROR" | "UNSET"; message?: string };
		attributes: Record<string, string | number | boolean>;
		events?: Array<{
			name: string;
			timestamp: number;
			attributes?: Record<string, unknown>;
		}>;
	}>;
}

interface WorkflowDefinition {
	id: string;
	name: string;
	version: string;
	startNode: string;
	nodes: Array<{
		id: string;
		type: string;
		procedureName?: string;
		next?: string | string[];
	}>;
}

export default function ExecutionDetailPage() {
	const params = useParams();
	const router = useRouter();
	const executionId = params.id as string;
	
	const [execution, setExecution] = useState<ExecutionDetail | null>(null);
	const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

	useEffect(() => {
		const loadExecution = async () => {
			try {
				// Load execution details
				const execResponse = await fetch(`/api/workflow/executions/${executionId}`);
				const execData = await execResponse.json();
				setExecution(execData);
				
				// Load workflow definition
				if (execData.workflowId) {
					const wfResponse = await fetch(`/api/workflow/definitions/${execData.workflowId}`);
					const wfData = await wfResponse.json();
					setWorkflow(wfData);
				}
			} catch (error) {
				console.error("Failed to load execution:", error);
			} finally {
				setIsLoading(false);
			}
		};
		
		loadExecution();
		
		// Setup SSE for live updates
		const eventSource = new EventSource(`/api/workflow/executions/${executionId}/stream`);
		
		eventSource.addEventListener("node.started", (event) => {
			try {
				const data = JSON.parse(event.data);
				console.log("[SSE] node.started:", data.nodeId);
				setExecution(prev => {
					if (!prev) return prev;
					return {
						...prev,
						nodeDetails: {
							...prev.nodeDetails,
							[data.nodeId]: {
								...prev.nodeDetails[data.nodeId],
								nodeId: data.nodeId,
								status: "running",
								startTime: new Date().toISOString(),
							},
						},
					};
				});
			} catch (error) {
				console.error("Failed to process SSE event:", error);
			}
		});
		
		eventSource.addEventListener("node.completed", (event) => {
			try {
				const data = JSON.parse(event.data);
				console.log("[SSE] node.completed:", data.nodeId, "output:", data.output);
				setExecution(prev => {
					if (!prev) return prev;
					
					// Добавить ноду в nodesExecuted если её там ещё нет
					const nodesExecuted = prev.nodesExecuted.includes(data.nodeId)
						? prev.nodesExecuted
						: [...prev.nodesExecuted, data.nodeId];
					
					return {
						...prev,
						nodesExecuted,
						nodeDetails: {
							...prev.nodeDetails,
							[data.nodeId]: {
								...prev.nodeDetails[data.nodeId],
								nodeId: data.nodeId,
								status: "completed",
								startTime: prev.nodeDetails[data.nodeId]?.startTime,
								endTime: new Date().toISOString(),
								output: data.output, // ← Добавляем output из события!
							},
						},
					};
				});
			} catch (error) {
				console.error("Failed to process SSE node.completed event:", error);
			}
		});
		
		eventSource.addEventListener("workflow.completed", (event) => {
			try {
				const data = JSON.parse(event.data);
				console.log("[SSE] workflow.completed received:", data);
				setExecution(prev => {
					if (!prev) return prev;
					return {
						...prev,
						status: "completed",
						endTime: new Date().toISOString(),
						executionTime: data.executionTime,
						nodesExecuted: data.nodesExecuted || prev.nodesExecuted,
					};
				});
				console.log("[SSE] Closing EventSource after workflow.completed");
				eventSource.close();
			} catch (error) {
				console.error("Failed to process workflow.completed event:", error);
			}
		});
		
		eventSource.addEventListener("workflow.failed", (event) => {
			try {
				const data = JSON.parse(event.data);
				console.log("[SSE] workflow.failed:", data);
				setExecution(prev => {
					if (!prev) return prev;
					return {
						...prev,
						status: "failed",
						endTime: new Date().toISOString(),
						executionTime: data.executionTime,
						error: data.error,
					};
				});
				console.log("[SSE] Closing EventSource after workflow.failed");
				eventSource.close();
			} catch (error) {
				console.error("Failed to process SSE event:", error);
			}
		});
		
		eventSource.onerror = (error) => {
			console.error("SSE connection error:", error);
			console.log("EventSource readyState:", eventSource.readyState);
			console.log("EventSource url:", eventSource.url);
			
			// Если соединение закрыто (не переподключается), проверяем финальный статус
			if (eventSource.readyState === EventSource.CLOSED) {
				console.log("[SSE] Connection closed, fetching final execution state...");
				setTimeout(async () => {
					try {
						const response = await fetch(`/api/workflow/executions/${executionId}`);
						const finalExecution = await response.json();
						console.log("[SSE] Final execution state:", finalExecution);
						
						if (finalExecution.status === "completed" || finalExecution.status === "failed") {
							setExecution(finalExecution);
						}
					} catch (err) {
						console.error("Failed to fetch final execution state:", err);
					}
				}, 1000);
			}
		};
		
		eventSource.onopen = () => {
			console.log("[SSE] Connection opened");
		};
		
		return () => {
			eventSource.close();
		};
	}, [executionId]);

	const getStatusIcon = (status: ExecutionDetail["status"]) => {
		switch (status) {
			case "completed":
				return <CheckCircle2 className="h-6 w-6 text-green-500" />;
			case "failed":
				return <XCircle className="h-6 w-6 text-red-500" />;
			case "running":
				return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />;
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

	const selectedNode = selectedNodeId && execution
		? execution.nodeDetails[selectedNodeId]
		: null;

	if (isLoading) {
		return (
			<main className="min-h-screen gradient-workflow p-8">
				<div className="max-w-7xl mx-auto flex items-center justify-center">
					<Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
				</div>
			</main>
		);
	}

	if (!execution) {
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

	return (
		<main className="min-h-screen gradient-workflow p-8">
			<div className="max-w-7xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<Button
								variant="ghost"
								onClick={() => router.push("/executions")}
							>
								<ArrowLeft className="mr-2 h-4 w-4" />
								Back
							</Button>
							<div>
								<h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
									{getStatusIcon(execution.status)}
									{execution.workflowName}
								</h1>
								<p className="text-muted-foreground mt-1">
									Execution ID: <code className="text-sm">{execution.executionId}</code>
								</p>
							</div>
						</div>
						<ThemeToggle />
					</div>
				</div>

				{/* Status Bar */}
				<Card className="mb-6">
					<CardContent className="p-6">
						<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
							<div>
								<p className="text-sm text-muted-foreground mb-1">Status</p>
								<Badge variant={execution.status === "completed" ? "default" : "destructive"} className="text-base">
									{execution.status}
								</Badge>
							</div>
							<div>
								<p className="text-sm text-muted-foreground mb-1">Duration</p>
								<p className="text-lg font-semibold font-mono">
									{formatDuration(execution.executionTime)}
								</p>
							</div>
							<div>
								<p className="text-sm text-muted-foreground mb-1">Nodes Executed</p>
								<p className="text-lg font-semibold">
									{execution.nodesExecuted.length} / {workflow?.nodes.length || 0}
								</p>
							</div>
							<div>
								<p className="text-sm text-muted-foreground mb-1">Started</p>
								<p className="text-sm">
									{new Date(execution.startTime).toLocaleString()}
								</p>
							</div>
						</div>

						{execution.error && (
							<Alert variant="destructive" className="mt-4">
								<AlertTriangle className="h-5 w-5" />
								<AlertTitle>Error</AlertTitle>
								<AlertDescription>
									<p className="font-semibold">{execution.error.name}</p>
									<p className="mt-1">{execution.error.message}</p>
									{execution.error.stack && (
										<pre className="mt-2 text-xs overflow-x-auto p-2 bg-black/10 rounded">
											{execution.error.stack}
										</pre>
									)}
								</AlertDescription>
							</Alert>
						)}
					</CardContent>
				</Card>

				{/* Main Content */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Left: Workflow Graph */}
					<div className="lg:col-span-2">
						<Card className="h-full">
							<Tabs defaultValue="graph" className="h-full flex flex-col">
								<TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
									<TabsTrigger value="graph" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
										📊 Graph
									</TabsTrigger>
									<TabsTrigger value="gantt" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
										📈 Timeline
									</TabsTrigger>
									<TabsTrigger value="trace" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
										🔍 Trace
									</TabsTrigger>
								</TabsList>

								<TabsContent value="graph" className="flex-1 m-0">
									{workflow && (
										<ExecutionGraph
											workflow={workflow}
											execution={execution}
											onNodeClick={setSelectedNodeId}
										/>
									)}
								</TabsContent>

								<TabsContent value="gantt" className="flex-1 m-0 p-6">
									<SpanGanttChart spans={execution.spans || []} />
								</TabsContent>

								<TabsContent value="trace" className="flex-1 m-0 p-6">
									<TraceViewer spans={execution.spans || []} />
								</TabsContent>
							</Tabs>
						</Card>
					</div>

					{/* Right: Node Details */}
					<div>
						<Card className="sticky top-8">
							<CardHeader>
								<CardTitle>
									{selectedNode ? "Node Details" : "Select a Node"}
								</CardTitle>
							</CardHeader>
							<CardContent>
								{selectedNode ? (
									<div className="space-y-4">
										<div>
											<p className="text-sm font-semibold text-muted-foreground mb-1">Node ID</p>
											<code className="text-sm">{selectedNode.nodeId}</code>
										</div>

										<div>
											<p className="text-sm font-semibold text-muted-foreground mb-1">Status</p>
											<Badge variant={selectedNode.status === "completed" ? "default" : "destructive"}>
												{selectedNode.status}
											</Badge>
										</div>

										{selectedNode.duration !== undefined && (
											<div>
												<p className="text-sm font-semibold text-muted-foreground mb-1">Duration</p>
												<p className="font-mono">{formatDuration(selectedNode.duration)}</p>
											</div>
										)}

										{selectedNode.output !== undefined && (
											<div>
												<p className="text-sm font-semibold text-muted-foreground mb-2">Output</p>
												<pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-64">
													{typeof selectedNode.output === "string" 
														? selectedNode.output 
														: JSON.stringify(selectedNode.output, null, 2)}
												</pre>
											</div>
										)}

										{selectedNode.error && (
											<Alert variant="destructive">
												<AlertTriangle className="h-4 w-4" />
												<AlertTitle>{selectedNode.error.name}</AlertTitle>
												<AlertDescription>{selectedNode.error.message}</AlertDescription>
											</Alert>
										)}
									</div>
								) : (
									<p className="text-sm text-muted-foreground text-center py-8">
										Click on a node in the graph to see its details
									</p>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</main>
	);
}
