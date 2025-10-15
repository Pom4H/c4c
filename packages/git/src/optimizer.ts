/**
 * Workflow optimizer
 * Analyzes execution traces and suggests improvements
 */

import type { WorkflowDefinition, WorkflowExecutionResult, TraceSpan } from "@tsdev/workflow";
import type { WorkflowImprovement } from "./types.js";

/**
 * Analyzes workflow executions and suggests improvements
 */
export class WorkflowOptimizer {
	/**
	 * Analyze single execution and suggest improvements
	 */
	analyzeExecution(execution: WorkflowExecutionResult, workflow: WorkflowDefinition): WorkflowImprovement[] {
		const improvements: WorkflowImprovement[] = [];

		// 1. Check for failures
		if (execution.status === "failed") {
			const failedNodes = this.findFailedNodes(execution.spans || []);
			if (failedNodes.length > 0) {
				improvements.push({
					type: "add-retry",
					nodes: failedNodes,
					reason: "Detected failures in execution",
					expectedImpact: "Improve success rate by 10-20%",
					confidence: 0.9,
				});

				improvements.push({
					type: "add-error-handling",
					nodes: failedNodes,
					reason: "Add fallback logic for failures",
					expectedImpact: "Graceful degradation",
					confidence: 0.85,
				});
			}
		}

		// 2. Check for slow nodes (> 1000ms)
		const slowNodes = this.findSlowNodes(execution.spans || [], 1000);
		if (slowNodes.length > 0) {
			improvements.push({
				type: "add-cache",
				nodes: slowNodes,
				reason: `Nodes taking > 1s: ${slowNodes.map((n) => `${n.nodeId}(${n.duration}ms)`).join(", ")}`,
				expectedImpact: "50-80% faster execution",
				confidence: 0.8,
			});
		}

		// 3. Check for parallelizable nodes
		const parallelizable = this.findParallelizableNodes(workflow, execution.spans || []);
		if (parallelizable.length > 1) {
			improvements.push({
				type: "parallelize",
				nodes: parallelizable,
				reason: `Found ${parallelizable.length} independent nodes that can run in parallel`,
				expectedImpact: `${Math.floor(parallelizable.length * 0.7)}x faster`,
				confidence: 0.75,
			});
		}

		// 4. Check overall execution time
		if (execution.executionTime > 5000) {
			improvements.push({
				type: "optimize",
				nodes: workflow.nodes.map((n) => n.id),
				reason: "Total execution time > 5s",
				expectedImpact: "Consider workflow redesign or caching",
				confidence: 0.6,
			});
		}

		return improvements;
	}

	/**
	 * Apply improvements to workflow
	 * Returns modified workflow
	 */
	async applyImprovements(
		workflow: WorkflowDefinition,
		improvements: WorkflowImprovement[],
	): Promise<WorkflowDefinition> {
		let improved = JSON.parse(JSON.stringify(workflow)) as WorkflowDefinition;

		for (const improvement of improvements) {
			switch (improvement.type) {
				case "add-retry":
					improved = this.addRetryLogic(improved, improvement.nodes);
					break;

				case "add-error-handling":
					improved = this.addErrorHandling(improved, improvement.nodes);
					break;

				case "parallelize":
					improved = this.convertToParallel(improved, improvement.nodes);
					break;

				case "add-cache":
					// Note: Caching is typically added at policy level, not workflow level
					// Could add metadata to suggest cache policy
					improved = this.addCacheMetadata(improved, improvement.nodes);
					break;

				case "optimize":
					// General optimization suggestions in metadata
					improved = this.addOptimizationMetadata(improved, improvement.reason);
					break;
			}
		}

		// Update version
		const currentVersion = improved.version || "1.0.0";
		const [major, minor, patch] = currentVersion.split(".").map(Number);
		improved.version = `${major}.${minor}.${patch + 1}`;

		return improved;
	}

	/**
	 * Find failed nodes from spans
	 */
	private findFailedNodes(spans: TraceSpan[]): string[] {
		const failedNodes = new Set<string>();

		for (const span of spans) {
			if (span.status?.code === "ERROR" && span.attributes?.["node.id"]) {
				failedNodes.add(span.attributes["node.id"] as string);
			}
		}

		return Array.from(failedNodes);
	}

	/**
	 * Find slow nodes from spans
	 */
	private findSlowNodes(
		spans: TraceSpan[],
		thresholdMs: number,
	): Array<{ nodeId: string; duration: number }> {
		const slowNodes: Array<{ nodeId: string; duration: number }> = [];

		for (const span of spans) {
			const nodeId = span.attributes?.["node.id"];
			const duration = span.duration || 0;

			if (nodeId && duration > thresholdMs) {
				slowNodes.push({ nodeId: nodeId as string, duration });
			}
		}

		return slowNodes;
	}

	/**
	 * Find nodes that can be parallelized
	 * Looks for sequential nodes that don't depend on each other
	 */
	private findParallelizableNodes(workflow: WorkflowDefinition, spans: TraceSpan[]): string[] {
		// Simple heuristic: find consecutive nodes where second doesn't use first's output
		const parallelizable: string[] = [];

		for (let i = 0; i < workflow.nodes.length - 1; i++) {
			const currentNode = workflow.nodes[i];
			const nextNode = workflow.nodes[i + 1];

			// Check if nextNode references currentNode's output
			const hasReference = this.nodeReferencesNode(nextNode, currentNode.id);

			if (!hasReference && currentNode.next === nextNode.id) {
				if (!parallelizable.includes(currentNode.id)) {
					parallelizable.push(currentNode.id);
				}
				if (!parallelizable.includes(nextNode.id)) {
					parallelizable.push(nextNode.id);
				}
			}
		}

		return parallelizable;
	}

	/**
	 * Check if node references another node's output
	 */
	private nodeReferencesNode(node: any, referencedNodeId: string): boolean {
		const configStr = JSON.stringify(node.config || {});
		return configStr.includes(referencedNodeId);
	}

	/**
	 * Add retry logic to nodes
	 */
	private addRetryLogic(workflow: WorkflowDefinition, nodeIds: string[]): WorkflowDefinition {
		const modified = { ...workflow };

		modified.nodes = workflow.nodes.map((node) => {
			if (nodeIds.includes(node.id)) {
				return {
					...node,
					metadata: {
						...(node.metadata || {}),
						retry: {
							maxAttempts: 3,
							backoff: "exponential",
							delayMs: 100,
						},
					},
				};
			}
			return node;
		});

		return modified;
	}

	/**
	 * Add error handling to nodes
	 */
	private addErrorHandling(workflow: WorkflowDefinition, nodeIds: string[]): WorkflowDefinition {
		const modified = { ...workflow };

		modified.nodes = workflow.nodes.map((node) => {
			if (nodeIds.includes(node.id)) {
				return {
					...node,
					onError: `${node.id}-error-handler`,
				};
			}
			return node;
		});

		// Add error handler nodes
		for (const nodeId of nodeIds) {
			const originalNode = workflow.nodes.find((n) => n.id === nodeId);
			if (originalNode) {
				modified.nodes.push({
					id: `${nodeId}-error-handler`,
					type: "procedure",
					procedureName: "logging.error",
					config: {
						message: `Error in ${nodeId}`,
						nodeId,
					},
				});
			}
		}

		return modified;
	}

	/**
	 * Convert sequential nodes to parallel
	 */
	private convertToParallel(workflow: WorkflowDefinition, nodeIds: string[]): WorkflowDefinition {
		if (nodeIds.length < 2) return workflow;

		const modified = { ...workflow };

		// Find first node in the sequence
		const firstNodeId = nodeIds[0];
		const firstNode = workflow.nodes.find((n) => n.id === firstNodeId);
		if (!firstNode) return workflow;

		// Create parallel node
		const parallelNodeId = `parallel-${nodeIds.join("-")}`;
		const parallelNode = {
			id: parallelNodeId,
			type: "parallel" as const,
			config: {
				branches: nodeIds,
				waitForAll: true,
			},
			next: firstNode.next, // Continue to original next
		};

		// Remove parallelized nodes' next references
		modified.nodes = workflow.nodes.map((node) => {
			if (nodeIds.includes(node.id)) {
				const { next, ...rest } = node;
				return rest;
			}
			return node;
		});

		// Add parallel node
		modified.nodes.push(parallelNode);

		// Update references to first node
		modified.nodes = modified.nodes.map((node) => {
			if (node.next === firstNodeId) {
				return { ...node, next: parallelNodeId };
			}
			return node;
		});

		// Update start node if needed
		if (modified.startNode === firstNodeId) {
			modified.startNode = parallelNodeId;
		}

		return modified;
	}

	/**
	 * Add cache metadata
	 */
	private addCacheMetadata(workflow: WorkflowDefinition, nodeIds: string[]): WorkflowDefinition {
		const modified = { ...workflow };

		modified.nodes = workflow.nodes.map((node) => {
			if (nodeIds.includes(node.id)) {
				return {
					...node,
					metadata: {
						...(node.metadata || {}),
						cache: {
							enabled: true,
							ttl: 3600, // 1 hour
						},
					},
				};
			}
			return node;
		});

		return modified;
	}

	/**
	 * Add optimization metadata
	 */
	private addOptimizationMetadata(workflow: WorkflowDefinition, reason: string): WorkflowDefinition {
		return {
			...workflow,
			metadata: {
				...(workflow.metadata || {}),
				optimizationSuggestions: [
					...(((workflow.metadata?.optimizationSuggestions as string[]) || []) as string[]),
					reason,
				],
			},
		};
	}
}
