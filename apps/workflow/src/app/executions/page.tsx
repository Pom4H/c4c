"use client";

/**
 * Executions List Page - like in n8n
 * Shows history of all workflow executions
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Loader2, Clock, Eye, Play } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

interface ExecutionRecord {
	executionId: string;
	workflowId: string;
	workflowName: string;
	status: "completed" | "failed" | "cancelled" | "running" | "paused";
	startTime: string;
	endTime?: string;
	executionTime?: number;
	nodesExecuted: string[];
	error?: {
		message: string;
		name: string;
	};
	// For paused executions
	pausedAt?: string;
	waitingFor?: string[];
	timeoutAt?: string;
	resumeState?: {
		variables?: Record<string, unknown>;
	};
}

interface ExecutionStats {
	total: number;
	completed: number;
	failed: number;
	running: number;
	paused: number;
}

interface WorkflowDefinition {
	id: string;
	name: string;
	nodeCount: number;
}

export default function ExecutionsPage() {
	const router = useRouter();
	const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
	const [stats, setStats] = useState<ExecutionStats>({ total: 0, completed: 0, failed: 0, running: 0, paused: 0 });
	const [isLoading, setIsLoading] = useState(true);
	const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
	const [selectedWorkflow, setSelectedWorkflow] = useState<string>("");
	const [isExecuting, setIsExecuting] = useState(false);
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [resumeData, setResumeData] = useState<Record<string, string>>({});
	const [expandedRow, setExpandedRow] = useState<string | null>(null);

	useEffect(() => {
		loadExecutions();
		loadWorkflows();
		
		// Setup SSE for real-time updates instead of polling
		const eventSource = new EventSource("/api/workflow/executions-stream");
		
		eventSource.addEventListener("executions.initial", (event) => {
			try {
				const data = JSON.parse(event.data);
				setExecutions(data.executions || []);
				setStats(data.stats || { total: 0, completed: 0, failed: 0, running: 0, paused: 0 });
			} catch (error) {
				console.error("Failed to process SSE initial event:", error);
			}
		});
		
		eventSource.addEventListener("executions.update", (event) => {
			try {
				const data = JSON.parse(event.data);
				setExecutions(data.executions || []);
				setStats(data.stats || { total: 0, completed: 0, failed: 0, running: 0, paused: 0 });
			} catch (error) {
				console.error("Failed to process SSE update event:", error);
			}
		});
		
		eventSource.onerror = () => {
			console.warn("SSE connection error, will auto-reconnect");
		};
		
		return () => {
			eventSource.close();
		};
	}, []);

	const loadWorkflows = async () => {
		try {
			const response = await fetch("/api/workflow/definitions");
			const data = await response.json();
			setWorkflows(data);
			if (data.length > 0) {
				setSelectedWorkflow(data[0].id);
			}
		} catch (error) {
			console.error("Failed to load workflows:", error);
		}
	};

	const handleExecute = async () => {
		if (!selectedWorkflow || isExecuting) return;
		
		setIsExecuting(true);
		try {
			const response = await fetch("/api/workflow/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					workflowId: selectedWorkflow,
					input: {},
					options: {
						executionId: `wf_exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
					},
				}),
			});
			
			const result = await response.json();
			
			if (response.ok) {
				// Reload executions to show new one
				await loadExecutions();
				// Navigate to execution detail
				router.push(`/executions/${result.executionId}`);
			} else {
				console.error("Failed to execute workflow:", result.error);
			}
		} catch (error) {
			console.error("Failed to execute workflow:", error);
		} finally {
			setIsExecuting(false);
		}
	};

	const loadExecutions = async () => {
		try {
			const response = await fetch("/api/workflow/executions");
			const data = await response.json();
			setExecutions(data.executions || []);
			setStats(data.stats || { total: 0, completed: 0, failed: 0, running: 0, paused: 0 });
		} catch (error) {
			console.error("Failed to load executions:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleResume = async (executionId: string, event: React.MouseEvent) => {
		event.stopPropagation(); // Prevent row click
		
		try {
			const data = resumeData[executionId] ? JSON.parse(resumeData[executionId]) : {};
			const response = await fetch("/api/workflow/resume", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ executionId, data }),
			});

			if (!response.ok) {
				throw new Error(`Failed to resume: ${response.statusText}`);
			}

			// Clear resume data
			setResumeData((prev) => {
				const next = { ...prev };
				delete next[executionId];
				return next;
			});
			setExpandedRow(null);
		} catch (error) {
			console.error("Failed to resume workflow:", error);
			alert(`Failed to resume: ${error instanceof Error ? error.message : String(error)}`);
		}
	};

	const filteredExecutions = statusFilter === "all" 
		? executions 
		: executions.filter(e => e.status === statusFilter);

	const getStatusIcon = (status: ExecutionRecord["status"]) => {
		switch (status) {
			case "completed":
				return <CheckCircle2 className="h-5 w-5 text-green-500" />;
			case "failed":
				return <XCircle className="h-5 w-5 text-red-500" />;
			case "running":
				return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
			case "paused":
				return <Clock className="h-5 w-5 text-yellow-500" />;
			default:
				return <Clock className="h-5 w-5 text-gray-500" />;
		}
	};

	const getStatusBadge = (status: ExecutionRecord["status"]) => {
		const variants = {
			completed: "default",
			failed: "destructive",
			running: "outline",
			cancelled: "secondary",
			paused: "secondary",
		} as const;
		
		const colors = {
			paused: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
		};
		
		return (
			<Badge 
				variant={variants[status] || "secondary"}
				className={status === "paused" ? colors.paused : ""}
			>
				{status}
			</Badge>
		);
	};

	const formatDuration = (ms?: number) => {
		if (!ms) return "-";
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
		return `${(ms / 60000).toFixed(2)}m`;
	};

	const formatTime = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		
		if (diff < 60000) return "Just now";
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		
		return date.toLocaleString();
	};

	return (
		<main className="min-h-screen gradient-workflow p-8">
			<div className="max-w-7xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-4xl font-bold text-foreground mb-2">
								📊 Workflow Executions
							</h1>
							<p className="text-muted-foreground">
								Monitor and track all workflow executions
							</p>
						</div>
						<ThemeToggle />
					</div>
				</div>

				{/* Execute Workflow */}
				<Card className="mb-6">
					<CardContent className="p-6">
						<div className="flex items-center gap-4">
							<div className="flex-1">
								<label className="block text-sm font-medium mb-2">
									Execute Workflow
								</label>
								<Select
									value={selectedWorkflow}
									onValueChange={setSelectedWorkflow}
									disabled={isExecuting}
								>
									<SelectTrigger>
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
							<Button
								onClick={handleExecute}
								disabled={!selectedWorkflow || isExecuting}
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
										Execute
									</>
								)}
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* Stats Cards */}
				<div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-muted-foreground">Total</p>
									<p className="text-3xl font-bold">{stats.total}</p>
								</div>
								<Clock className="h-8 w-8 text-blue-500 opacity-20" />
							</div>
						</CardContent>
					</Card>
					
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-muted-foreground">Completed</p>
									<p className="text-3xl font-bold text-green-500">{stats.completed}</p>
								</div>
								<CheckCircle2 className="h-8 w-8 text-green-500 opacity-20" />
							</div>
						</CardContent>
					</Card>
					
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-muted-foreground">Failed</p>
									<p className="text-3xl font-bold text-red-500">{stats.failed}</p>
								</div>
								<XCircle className="h-8 w-8 text-red-500 opacity-20" />
							</div>
						</CardContent>
					</Card>
					
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-muted-foreground">Running</p>
									<p className="text-3xl font-bold text-blue-500">{stats.running}</p>
								</div>
								<Loader2 className="h-8 w-8 text-blue-500 opacity-20 animate-spin" />
							</div>
						</CardContent>
					</Card>
					
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-muted-foreground">Paused</p>
									<p className="text-3xl font-bold text-yellow-500">{stats.paused}</p>
								</div>
								<Clock className="h-8 w-8 text-yellow-500 opacity-20" />
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Executions Table */}
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle>Recent Executions</CardTitle>
							<Select value={statusFilter} onValueChange={setStatusFilter}>
								<SelectTrigger className="w-[180px]">
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Status</SelectItem>
									<SelectItem value="running">Running</SelectItem>
									<SelectItem value="paused">Paused</SelectItem>
									<SelectItem value="completed">Completed</SelectItem>
									<SelectItem value="failed">Failed</SelectItem>
									<SelectItem value="cancelled">Cancelled</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="flex items-center justify-center py-12">
								<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
							</div>
						) : filteredExecutions.length === 0 ? (
							<div className="text-center py-12 text-muted-foreground">
								<p>No executions {statusFilter !== "all" && `with status "${statusFilter}"`}</p>
								<p className="text-sm mt-2">
									{executions.length === 0 ? "Execute a workflow to see it here" : "Try changing the filter"}
								</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Status</TableHead>
											<TableHead>Workflow</TableHead>
											<TableHead>Execution ID</TableHead>
											<TableHead>Started</TableHead>
											<TableHead>Duration</TableHead>
											<TableHead>Nodes</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredExecutions.map((exec) => (
											<>
											<TableRow
												key={exec.executionId}
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => exec.status !== "paused" && router.push(`/executions/${exec.executionId}`)}
											>
												<TableCell>
													<div className="flex items-center gap-2">
														{getStatusIcon(exec.status)}
														{getStatusBadge(exec.status)}
													</div>
												</TableCell>
												<TableCell>
													<div>
														<p className="font-medium">{exec.workflowName}</p>
														<p className="text-sm text-muted-foreground font-mono">
															{exec.workflowId}
														</p>
													</div>
												</TableCell>
												<TableCell>
													<code className="text-sm">{exec.executionId.slice(0, 16)}...</code>
												</TableCell>
												<TableCell>
													<span className="text-sm">{formatTime(exec.startTime)}</span>
												</TableCell>
												<TableCell>
													<span className="font-mono text-sm">
														{formatDuration(exec.executionTime)}
													</span>
												</TableCell>
												<TableCell>
													<Badge variant="outline">
														{exec.nodesExecuted.length} nodes
													</Badge>
												</TableCell>
												<TableCell className="text-right">
													{exec.status === "paused" ? (
														<div className="flex items-center justify-end gap-2">
															<Button
																variant="outline"
																size="sm"
																onClick={(e) => {
																	e.stopPropagation();
																	setExpandedRow(
																		expandedRow === exec.executionId ? null : exec.executionId
																	);
																}}
															>
																{expandedRow === exec.executionId ? "Collapse" : "Expand"}
															</Button>
															<Button
																variant="default"
																size="sm"
																onClick={(e) => handleResume(exec.executionId, e)}
															>
																<Play className="h-4 w-4 mr-2" />
																Resume
															</Button>
														</div>
													) : (
														<Button
															variant="ghost"
															size="sm"
															onClick={(e) => {
																e.stopPropagation();
																router.push(`/executions/${exec.executionId}`);
															}}
														>
															<Eye className="h-4 w-4 mr-2" />
															View
														</Button>
													)}
												</TableCell>
											</TableRow>
											
											{/* Expanded row for paused executions */}
											{exec.status === "paused" && expandedRow === exec.executionId && (
												<TableRow>
													<TableCell colSpan={7} className="bg-muted/30">
														<div className="p-4 space-y-4">
															<div className="grid grid-cols-2 gap-4">
																<div>
																	<p className="text-sm font-medium mb-1">Paused At</p>
																	<p className="text-sm text-muted-foreground">{exec.pausedAt}</p>
																</div>
																<div>
																	<p className="text-sm font-medium mb-1">Waiting For</p>
																	<div className="flex gap-2">
																		{exec.waitingFor?.map((trigger, idx) => (
																			<Badge key={idx} variant="outline">
																				{trigger}
																			</Badge>
																		))}
																	</div>
																</div>
																{exec.timeoutAt && (
																	<div>
																		<p className="text-sm font-medium mb-1">Timeout At</p>
																		<p className="text-sm text-muted-foreground">{formatTime(exec.timeoutAt)}</p>
																	</div>
																)}
															</div>
															
															<div>
																<label className="text-sm font-medium mb-2 block">
																	Resume Data (JSON)
																</label>
																<textarea
																	className="w-full px-3 py-2 border rounded-md font-mono text-sm bg-background"
																	rows={4}
																	placeholder='{"key": "value"}'
																	value={resumeData[exec.executionId] || ""}
																	onChange={(e) =>
																		setResumeData({
																			...resumeData,
																			[exec.executionId]: e.target.value,
																		})
																	}
																	onClick={(e) => e.stopPropagation()}
																/>
																<p className="text-xs text-muted-foreground mt-1">
																	Optional: Provide data to pass when resuming this workflow
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
							</div>
						)}
					</CardContent>
				</Card>

				{/* Footer */}
				<div className="mt-8 text-center text-muted-foreground text-sm">
					<p>Workflow Execution Monitor - c4c Framework</p>
				</div>
			</div>
		</main>
	);
}
