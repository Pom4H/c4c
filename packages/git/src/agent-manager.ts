/**
 * High-level API for AI agents to manage workflows
 * Handles workflow discovery, execution, analysis, and improvement
 */

import type { Registry } from "@tsdev/core";
import {
	executeWorkflow,
	validateWorkflow,
	type WorkflowDefinition,
	type WorkflowExecutionResult,
} from "@tsdev/workflow";
import { GitWorkflowStorage } from "./storage.js";
import { WorkflowOptimizer } from "./optimizer.js";
import type { GitConfig, WorkflowImprovement, WorkflowSaveResult } from "./types.js";

/**
 * Options for handling agent tasks
 */
export interface AgentTaskOptions {
	/** Input data for workflow */
	input?: Record<string, unknown>;
	/** Minimum confidence for workflow match (0-1) */
	minConfidence?: number;
	/** Auto-create PR for improvements */
	autoImprove?: boolean;
	/** Agent identifier */
	agentId?: string;
}

/**
 * Result of agent task handling
 */
export interface AgentTaskResult {
	/** Execution result */
	execution: WorkflowExecutionResult;
	/** Whether workflow was found or created */
	workflowSource: "cached" | "created";
	/** Workflow used */
	workflow: WorkflowDefinition;
	/** Improvements suggested (if any) */
	improvements?: WorkflowImprovement[];
	/** PR info (if created) */
	pr?: {
		url: string;
		number: number;
	};
}

/**
 * Manager for AI agent workflow operations
 * Provides high-level API for agents to:
 * - Find existing workflows
 * - Create new workflows
 * - Execute workflows
 * - Improve workflows based on traces
 */
export class AgentWorkflowManager {
	constructor(
		private storage: GitWorkflowStorage,
		private registry: Registry,
		private optimizer: WorkflowOptimizer,
	) {}

	/**
	 * Factory method to create manager with git config
	 */
	static create(gitConfig: GitConfig, registry: Registry): AgentWorkflowManager {
		const storage = new GitWorkflowStorage(gitConfig);
		const optimizer = new WorkflowOptimizer();
		return new AgentWorkflowManager(storage, registry, optimizer);
	}

	/**
	 * Handle task for AI agent
	 * Main entry point for agents
	 * 
	 * 1. Search for existing workflow
	 * 2. If not found, expect agent to provide workflow
	 * 3. Execute workflow
	 * 4. Analyze traces
	 * 5. Suggest/apply improvements
	 */
	async handleTask(
		task: string,
		workflow: WorkflowDefinition | null,
		options: AgentTaskOptions = {},
	): Promise<AgentTaskResult> {
		const { input = {}, minConfidence = 0.6, autoImprove = true, agentId } = options;

		let usedWorkflow: WorkflowDefinition;
		let workflowSource: "cached" | "created";

		// 1. Try to find existing workflow
		const matches = await this.storage.search({ task, minConfidence });

		if (matches.length > 0) {
			// Found existing workflow
			usedWorkflow = matches[0].workflow;
			workflowSource = "cached";
			console.log(`[Agent] Found cached workflow: ${usedWorkflow.id} (confidence: ${(matches[0].confidence * 100).toFixed(1)}%)`);
		} else if (workflow) {
			// Agent provides new workflow
			usedWorkflow = workflow;
			workflowSource = "created";
			console.log(`[Agent] Using new workflow: ${workflow.id}`);

			// Validate workflow
			const errors = validateWorkflow(usedWorkflow, this.registry);
			if (errors.length > 0) {
				throw new Error(`Workflow validation failed: ${errors.join(", ")}`);
			}

			// Save to git with draft PR
			await this.storage.save(
				usedWorkflow,
				{
					task,
					agent: agentId,
				},
				true, // Create draft PR
			);
		} else {
			throw new Error(`No workflow found for task "${task}" and no workflow provided`);
		}

		// 2. Execute workflow
		console.log(`[Agent] Executing workflow: ${usedWorkflow.id}`);
		const execution = await executeWorkflow(usedWorkflow, this.registry, input);

		// 3. Analyze execution and suggest improvements
		const improvements = this.optimizer.analyzeExecution(execution, usedWorkflow);

		const result: AgentTaskResult = {
			execution,
			workflowSource,
			workflow: usedWorkflow,
			improvements: improvements.length > 0 ? improvements : undefined,
		};

		// 4. Auto-improve if requested and improvements found
		if (autoImprove && improvements.length > 0) {
			console.log(`[Agent] Applying ${improvements.length} improvement(s)...`);

			const improved = await this.optimizer.applyImprovements(usedWorkflow, improvements);

			// Save improved workflow
			const saveResult = await this.storage.update(improved, {
				improvements,
				agent: agentId,
				executionStats: {
					totalExecutions: 1,
					successRate: execution.status === "completed" ? 1 : 0,
					avgDuration: execution.executionTime,
					p95Duration: execution.executionTime,
				},
			});

			result.pr = saveResult.prUrl
				? {
						url: saveResult.prUrl,
						number: saveResult.prNumber!,
					}
				: undefined;
		}

		return result;
	}

	/**
	 * Find workflow for task
	 * Returns best matching workflow or null
	 */
	async findWorkflow(task: string, minConfidence = 0.6): Promise<WorkflowDefinition | null> {
		const matches = await this.storage.search({ task, minConfidence });
		return matches.length > 0 ? matches[0].workflow : null;
	}

	/**
	 * Save workflow to git
	 * Creates branch and draft PR
	 */
	async saveWorkflow(
		workflow: WorkflowDefinition,
		task?: string,
		agentId?: string,
	): Promise<WorkflowSaveResult> {
		return await this.storage.save(
			workflow,
			{
				task,
				agent: agentId,
			},
			true,
		);
	}

	/**
	 * Improve workflow based on execution results
	 * Analyzes traces and creates PR with improvements
	 */
	async improveWorkflow(
		workflow: WorkflowDefinition,
		executions: WorkflowExecutionResult[],
		agentId?: string,
	): Promise<WorkflowSaveResult | null> {
		// Analyze all executions
		const allImprovements: WorkflowImprovement[] = [];
		for (const execution of executions) {
			const improvements = this.optimizer.analyzeExecution(execution, workflow);
			allImprovements.push(...improvements);
		}

		if (allImprovements.length === 0) {
			console.log("[Agent] No improvements needed");
			return null;
		}

		// Remove duplicates
		const uniqueImprovements = this.deduplicateImprovements(allImprovements);

		// Apply improvements
		const improved = await this.optimizer.applyImprovements(workflow, uniqueImprovements);

		// Calculate stats
		const stats = this.calculateExecutionStats(executions);

		// Save with PR
		return await this.storage.update(improved, {
			improvements: uniqueImprovements,
			agent: agentId,
			executionStats: stats,
		});
	}

	/**
	 * List all workflows
	 */
	async listWorkflows(): Promise<WorkflowDefinition[]> {
		return await this.storage.listAll();
	}

	/**
	 * Get workflow by ID
	 */
	async getWorkflow(workflowId: string): Promise<WorkflowDefinition | null> {
		return await this.storage.load(workflowId);
	}

	/**
	 * Deduplicate improvements
	 */
	private deduplicateImprovements(improvements: WorkflowImprovement[]): WorkflowImprovement[] {
		const seen = new Set<string>();
		const unique: WorkflowImprovement[] = [];

		for (const improvement of improvements) {
			const key = `${improvement.type}-${improvement.nodes.sort().join(",")}`;
			if (!seen.has(key)) {
				seen.add(key);
				unique.push(improvement);
			}
		}

		return unique;
	}

	/**
	 * Calculate execution statistics
	 */
	private calculateExecutionStats(executions: WorkflowExecutionResult[]) {
		const totalExecutions = executions.length;
		const successful = executions.filter((e) => e.status === "completed").length;
		const successRate = successful / totalExecutions;

		const durations = executions.map((e) => e.executionTime);
		const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;

		// Calculate P95
		const sorted = [...durations].sort((a, b) => a - b);
		const p95Index = Math.floor(sorted.length * 0.95);
		const p95Duration = sorted[p95Index] || avgDuration;

		return {
			totalExecutions,
			successRate,
			avgDuration: Math.round(avgDuration),
			p95Duration: Math.round(p95Duration),
		};
	}
}
