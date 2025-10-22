"use client";

/**
 * Executions List Page - как в n8n
 * Показывает историю всех выполнений workflows
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
	status: "completed" | "failed" | "cancelled" | "running";
	startTime: string;
	endTime?: string;
	executionTime?: number;
	nodesExecuted: string[];
	error?: {
		message: string;
		name: string;
	};
}

interface ExecutionStats {
	total: number;
	completed: number;
	failed: number;
	running: number;
}

interface WorkflowDefinition {
	id: string;
	name: string;
	nodeCount: number;
}

export default function ExecutionsPage() {
	const router = useRouter();
	const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
	const [stats, setStats] = useState<ExecutionStats>({ total: 0, completed: 0, failed: 0, running: 0 });
	const [isLoading, setIsLoading] = useState(true);
	const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
	const [selectedWorkflow, setSelectedWorkflow] = useState<string>("");
	const [isExecuting, setIsExecuting] = useState(false);

	useEffect(() => {
		loadExecutions();
		loadWorkflows();
		// Refresh every 2 seconds
		const interval = setInterval(loadExecutions, 2000);
		return () => clearInterval(interval);
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
			setStats(data.stats || { total: 0, completed: 0, failed: 0, running: 0 });
		} catch (error) {
			console.error("Failed to load executions:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const getStatusIcon = (status: ExecutionRecord["status"]) => {
		switch (status) {
			case "completed":
				return <CheckCircle2 className="h-5 w-5 text-green-500" />;
			case "failed":
				return <XCircle className="h-5 w-5 text-red-500" />;
			case "running":
				return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
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
		} as const;
		
		return (
			<Badge variant={variants[status] || "secondary"}>
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
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
				</div>

				{/* Executions Table */}
				<Card>
					<CardHeader>
						<CardTitle>Recent Executions</CardTitle>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="flex items-center justify-center py-12">
								<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
							</div>
						) : executions.length === 0 ? (
							<div className="text-center py-12 text-muted-foreground">
								<p>No executions yet</p>
								<p className="text-sm mt-2">Execute a workflow to see it here</p>
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
										{executions.map((exec) => (
											<TableRow
												key={exec.executionId}
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => router.push(`/executions/${exec.executionId}`)}
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
												</TableCell>
											</TableRow>
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
