"use client";

/**
 * Execution Graph - показывает workflow граф с статусами нод
 * Как в n8n - цветные ноды показывают статус выполнения
 */

import { useCallback, useMemo, useEffect } from "react";
import {
	ReactFlow,
	Background,
	Controls,
	type Node,
	type Edge,
	MarkerType,
	useNodesState,
	useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface NodeDetail {
	nodeId: string;
	status: "pending" | "running" | "completed" | "failed" | "skipped";
	startTime?: string;
	endTime?: string;
	duration?: number;
}

interface ExecutionDetail {
	executionId: string;
	status: string;
	nodesExecuted: string[];
	nodeDetails: Record<string, NodeDetail>;
}

interface WorkflowDefinition {
	id: string;
	name: string;
	nodes: Array<{
		id: string;
		type: string;
		procedureName?: string;
		next?: string | string[];
	}>;
}

interface ExecutionGraphProps {
	workflow: WorkflowDefinition;
	execution: ExecutionDetail;
	onNodeClick?: (nodeId: string) => void;
}

export default function ExecutionGraph({ workflow, execution, onNodeClick }: ExecutionGraphProps) {
	// Создать ноды с статусами
	const initialNodes: Node[] = useMemo(() => {
		return workflow.nodes.map((node, index) => {
			const nodeDetail = execution.nodeDetails[node.id];
			const status = nodeDetail?.status || "pending";
			
			// Определить цвет по статусу
			const getNodeColor = (status: string) => {
				switch (status) {
					case "completed":
						return { bg: "#10b981", border: "#059669", text: "#ffffff" }; // green
					case "failed":
						return { bg: "#ef4444", border: "#dc2626", text: "#ffffff" }; // red
					case "running":
						return { bg: "#3b82f6", border: "#2563eb", text: "#ffffff" }; // blue
					case "skipped":
						return { bg: "#6b7280", border: "#4b5563", text: "#ffffff" }; // gray
					default:
						return { bg: "#e5e7eb", border: "#d1d5db", text: "#374151" }; // light gray
				}
			};
			
			const colors = getNodeColor(status);
			const isExecuted = execution.nodesExecuted.includes(node.id);
			
			// Иконки для типов нод
			const getNodeIcon = (type: string) => {
				switch (type) {
					case "trigger":
						return "🎯";
					case "procedure":
						return "⚙️";
					case "condition":
						return "🔀";
					case "parallel":
						return "⚡";
					default:
						return "📦";
				}
			};

			return {
				id: node.id,
				type: "default",
				position: {
					x: 100 + (index % 3) * 300,
					y: 100 + Math.floor(index / 3) * 150,
				},
				data: {
					label: (
						<div className="px-4 py-2">
							<div className="flex items-center gap-2 mb-1">
								<span className="text-lg">{getNodeIcon(node.type)}</span>
								<span className="font-semibold">{node.id}</span>
							</div>
							<div className="text-xs opacity-90">{node.type}</div>
							{node.procedureName && (
								<div className="text-xs opacity-75 mt-1 font-mono truncate max-w-[200px]">
									{node.procedureName}
								</div>
							)}
							{nodeDetail?.duration !== undefined && (
								<div className="text-xs font-semibold mt-1">
									{nodeDetail.duration < 1000
										? `${nodeDetail.duration}ms`
										: `${(nodeDetail.duration / 1000).toFixed(2)}s`}
								</div>
							)}
						</div>
					),
				},
				style: {
					background: colors.bg,
					border: `2px solid ${colors.border}`,
					borderRadius: "8px",
					color: colors.text,
					opacity: isExecuted ? 1 : 0.5,
					boxShadow: status === "running" ? "0 0 0 3px rgba(59, 130, 246, 0.3)" : undefined,
				},
			};
		});
	}, [workflow, execution]);

	// Создать ребра
	const initialEdges: Edge[] = useMemo(() => {
		const edges: Edge[] = [];
		
		workflow.nodes.forEach((node) => {
			// Обработка обычных next переходов
			if (node.next) {
				const nextNodes = Array.isArray(node.next) ? node.next : [node.next];
				nextNodes.forEach((nextId) => {
					const sourceExecuted = execution.nodesExecuted.includes(node.id);
					const targetExecuted = execution.nodesExecuted.includes(nextId);
					const wasTraversed = sourceExecuted && targetExecuted;
					
					edges.push({
						id: `${node.id}-${nextId}`,
						source: node.id,
						target: nextId,
						type: "smoothstep",
						animated: wasTraversed,
						style: {
							stroke: wasTraversed ? "#10b981" : "#d1d5db",
							strokeWidth: wasTraversed ? 2 : 1,
						},
						markerEnd: {
							type: MarkerType.ArrowClosed,
							color: wasTraversed ? "#10b981" : "#d1d5db",
						},
					});
				});
			}
			
			// Обработка параллельных нод - создаем ребра к branches
			if (node.type === "parallel" && (node as any).config?.branches) {
				const branches = (node as any).config.branches as string[];
				branches.forEach((branchId) => {
					const sourceExecuted = execution.nodesExecuted.includes(node.id);
					const targetExecuted = execution.nodesExecuted.includes(branchId);
					const wasTraversed = sourceExecuted && targetExecuted;
					
					edges.push({
						id: `${node.id}-branch-${branchId}`,
						source: node.id,
						target: branchId,
						type: "smoothstep",
						animated: wasTraversed,
						style: {
							stroke: wasTraversed ? "#10b981" : "#d1d5db",
							strokeWidth: wasTraversed ? 2 : 1,
							strokeDasharray: "5,5", // Пунктирная линия для параллельных веток
						},
						markerEnd: {
							type: MarkerType.ArrowClosed,
							color: wasTraversed ? "#10b981" : "#d1d5db",
						},
					});
				});
			}
		});
		
		return edges;
	}, [workflow, execution]);

	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

	// Обновлять nodes и edges когда execution меняется
	useEffect(() => {
		setNodes(initialNodes);
	}, [initialNodes, setNodes]);

	useEffect(() => {
		setEdges(initialEdges);
	}, [initialEdges, setEdges]);

	const handleNodeClick = useCallback(
		(_event: React.MouseEvent, node: Node) => {
			if (onNodeClick) {
				onNodeClick(node.id);
			}
		},
		[onNodeClick]
	);

	return (
		<div className="w-full h-[600px] bg-background">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onNodeClick={handleNodeClick}
				fitView
				attributionPosition="bottom-left"
			>
				<Background />
				<Controls />
			</ReactFlow>
			
			{/* Legend */}
			<div className="absolute bottom-4 right-4 bg-card border rounded-lg p-3 shadow-lg text-sm">
				<div className="font-semibold mb-2">Status Legend</div>
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<div className="w-4 h-4 rounded" style={{ background: "#10b981" }} />
						<span>Completed</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-4 h-4 rounded" style={{ background: "#3b82f6" }} />
						<span>Running</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-4 h-4 rounded" style={{ background: "#ef4444" }} />
						<span>Failed</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-4 h-4 rounded" style={{ background: "#e5e7eb" }} />
						<span>Pending</span>
					</div>
				</div>
			</div>
		</div>
	);
}
