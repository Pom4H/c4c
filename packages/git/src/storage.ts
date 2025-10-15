/**
 * Git-based workflow storage
 * Handles saving, loading, and versioning workflows in git
 */

import { simpleGit, type SimpleGit } from "simple-git";
import { Octokit } from "@octokit/rest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { WorkflowDefinition } from "@tsdev/workflow";
import type {
	GitConfig,
	WorkflowSaveResult,
	WorkflowCommitMetadata,
	CreatePROptions,
	WorkflowMatch,
	WorkflowSearchQuery,
} from "./types.js";

/**
 * Git-based storage for workflows
 * Enables AI agents to save, version, and improve workflows via git
 */
export class GitWorkflowStorage {
	private git: SimpleGit;
	private octokit?: Octokit;
	private config: GitConfig;

	constructor(config: GitConfig) {
		this.config = config;
		this.git = simpleGit(config.repoPath);

		if (config.githubToken && config.githubRepo) {
			this.octokit = new Octokit({
				auth: config.githubToken,
			});
		}
	}

	/**
	 * Save workflow to git
	 * Creates branch, commits, and optionally creates draft PR
	 */
	async save(
		workflow: WorkflowDefinition,
		metadata: WorkflowCommitMetadata = {},
		createPR = true,
	): Promise<WorkflowSaveResult> {
		const workflowId = workflow.id;
		const branchName = `workflows/${workflowId}-${Date.now()}`;
		const filePath = path.join(this.config.workflowsDir, `${workflowId}.json`);

		// 1. Ensure we're on default branch and up to date
		await this.git.fetch();
		await this.git.checkout(this.config.defaultBranch);
		await this.git.pull();

		// 2. Create new branch
		await this.git.checkoutLocalBranch(branchName);

		// 3. Write workflow file
		const fullPath = path.join(this.config.repoPath, filePath);
		await fs.mkdir(path.dirname(fullPath), { recursive: true });
		await fs.writeFile(fullPath, JSON.stringify(workflow, null, 2));

		// 4. Commit
		await this.git.add(filePath);
		const commitMessage = this.generateCommitMessage(workflow, metadata);
		const commit = await this.git.commit(commitMessage);
		const commitSha = commit.commit;

		// 5. Push branch
		await this.git.push("origin", branchName);

		const result: WorkflowSaveResult = {
			workflowId,
			branch: branchName,
			commitSha,
		};

		// 6. Create draft PR if requested and GitHub is configured
		if (createPR && this.octokit && this.config.githubRepo) {
			const pr = await this.createDraftPR(workflow, metadata, branchName);
			result.prUrl = pr.url;
			result.prNumber = pr.number;
		}

		// 7. Return to default branch
		await this.git.checkout(this.config.defaultBranch);

		return result;
	}

	/**
	 * Load workflow from git
	 */
	async load(workflowId: string): Promise<WorkflowDefinition | null> {
		const filePath = path.join(this.config.repoPath, this.config.workflowsDir, `${workflowId}.json`);

		try {
			const content = await fs.readFile(filePath, "utf-8");
			return JSON.parse(content) as WorkflowDefinition;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return null;
			}
			throw error;
		}
	}

	/**
	 * List all workflows in git
	 */
	async listAll(): Promise<WorkflowDefinition[]> {
		const workflowsPath = path.join(this.config.repoPath, this.config.workflowsDir);

		try {
			const files = await fs.readdir(workflowsPath);
			const workflows: WorkflowDefinition[] = [];

			for (const file of files) {
				if (file.endsWith(".json")) {
					const content = await fs.readFile(path.join(workflowsPath, file), "utf-8");
					workflows.push(JSON.parse(content));
				}
			}

			return workflows;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return [];
			}
			throw error;
		}
	}

	/**
	 * Search for workflows matching a query
	 * Uses semantic matching based on workflow metadata
	 */
	async search(query: WorkflowSearchQuery): Promise<WorkflowMatch[]> {
		const workflows = await this.listAll();
		const matches: WorkflowMatch[] = [];

		for (const workflow of workflows) {
			const confidence = this.calculateMatchConfidence(workflow, query);

			if (confidence >= (query.minConfidence || 0.5)) {
				matches.push({
					workflow,
					confidence,
					filePath: path.join(this.config.workflowsDir, `${workflow.id}.json`),
					matchReason: this.generateMatchReason(workflow, query),
				});
			}
		}

		// Sort by confidence (descending)
		return matches.sort((a, b) => b.confidence - a.confidence);
	}

	/**
	 * Update existing workflow
	 * Creates new branch and PR with improvements
	 */
	async update(
		workflow: WorkflowDefinition,
		metadata: WorkflowCommitMetadata,
	): Promise<WorkflowSaveResult> {
		return await this.save(workflow, metadata, true);
	}

	/**
	 * Check if workflow exists
	 */
	async exists(workflowId: string): Promise<boolean> {
		const filePath = path.join(this.config.repoPath, this.config.workflowsDir, `${workflowId}.json`);

		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Create draft pull request on GitHub
	 */
	private async createDraftPR(
		workflow: WorkflowDefinition,
		metadata: WorkflowCommitMetadata,
		branchName: string,
	): Promise<{ url: string; number: number }> {
		if (!this.octokit || !this.config.githubRepo) {
			throw new Error("GitHub not configured");
		}

		const [owner, repo] = this.config.githubRepo.split("/");

		const options: CreatePROptions = {
			title: this.generatePRTitle(workflow, metadata),
			body: this.generatePRBody(workflow, metadata),
			draft: true,
			labels: ["workflow", "ai-agent"],
		};

		const pr = await this.octokit.pulls.create({
			owner,
			repo,
			title: options.title,
			body: options.body,
			head: branchName,
			base: this.config.defaultBranch,
			draft: options.draft,
		});

		// Add labels if specified
		if (options.labels && options.labels.length > 0) {
			await this.octokit.issues.addLabels({
				owner,
				repo,
				issue_number: pr.data.number,
				labels: options.labels,
			});
		}

		return {
			url: pr.data.html_url,
			number: pr.data.number,
		};
	}

	/**
	 * Generate commit message from workflow and metadata
	 */
	private generateCommitMessage(workflow: WorkflowDefinition, metadata: WorkflowCommitMetadata): string {
		const lines: string[] = [];

		// Title
		if (metadata.improvements && metadata.improvements.length > 0) {
			const types = metadata.improvements.map((i) => i.type).join(", ");
			lines.push(`Improve ${workflow.id} workflow: ${types}`);
		} else if (metadata.task) {
			lines.push(`Add ${workflow.id} workflow for: ${metadata.task}`);
		} else {
			lines.push(`Add ${workflow.id} workflow`);
		}

		lines.push(""); // Empty line

		// Description
		if (workflow.description) {
			lines.push(workflow.description);
			lines.push("");
		}

		// Improvements
		if (metadata.improvements && metadata.improvements.length > 0) {
			lines.push("Improvements:");
			for (const improvement of metadata.improvements) {
				lines.push(`- ${improvement.type}: ${improvement.reason}`);
				if (improvement.expectedImpact) {
					lines.push(`  Expected: ${improvement.expectedImpact}`);
				}
			}
			lines.push("");
		}

		// Execution stats
		if (metadata.executionStats) {
			const stats = metadata.executionStats;
			lines.push("Execution Statistics:");
			lines.push(`- Total executions: ${stats.totalExecutions}`);
			lines.push(`- Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
			lines.push(`- Avg duration: ${stats.avgDuration}ms`);
			lines.push(`- P95 duration: ${stats.p95Duration}ms`);
			lines.push("");
		}

		// Agent
		if (metadata.agent) {
			lines.push(`Agent: ${metadata.agent}`);
		}

		return lines.join("\n");
	}

	/**
	 * Generate PR title
	 */
	private generatePRTitle(workflow: WorkflowDefinition, metadata: WorkflowCommitMetadata): string {
		if (metadata.improvements && metadata.improvements.length > 0) {
			return `🤖 Improve ${workflow.name || workflow.id} workflow`;
		}
		return `🤖 Add ${workflow.name || workflow.id} workflow`;
	}

	/**
	 * Generate PR body
	 */
	private generatePRBody(workflow: WorkflowDefinition, metadata: WorkflowCommitMetadata): string {
		const sections: string[] = [];

		// Header
		sections.push("## AI Agent Workflow Contribution");
		sections.push("");

		if (metadata.task) {
			sections.push(`**Task:** ${metadata.task}`);
			sections.push("");
		}

		// Workflow info
		sections.push("### Workflow Details");
		sections.push(`- **ID:** \`${workflow.id}\``);
		sections.push(`- **Name:** ${workflow.name || "N/A"}`);
		sections.push(`- **Version:** ${workflow.version || "1.0.0"}`);
		sections.push(`- **Nodes:** ${workflow.nodes.length}`);
		sections.push("");

		if (workflow.description) {
			sections.push(`**Description:** ${workflow.description}`);
			sections.push("");
		}

		// Improvements
		if (metadata.improvements && metadata.improvements.length > 0) {
			sections.push("### Improvements Applied");
			sections.push("");
			for (const improvement of metadata.improvements) {
				sections.push(`#### ${improvement.type}`);
				sections.push(`- **Reason:** ${improvement.reason}`);
				sections.push(`- **Nodes affected:** ${improvement.nodes.join(", ")}`);
				if (improvement.expectedImpact) {
					sections.push(`- **Expected impact:** ${improvement.expectedImpact}`);
				}
				if (improvement.confidence) {
					sections.push(`- **Confidence:** ${(improvement.confidence * 100).toFixed(1)}%`);
				}
				sections.push("");
			}
		}

		// Execution stats
		if (metadata.executionStats) {
			const stats = metadata.executionStats;
			sections.push("### Execution Statistics");
			sections.push("");
			sections.push("| Metric | Value |");
			sections.push("|--------|-------|");
			sections.push(`| Total Executions | ${stats.totalExecutions} |`);
			sections.push(`| Success Rate | ${(stats.successRate * 100).toFixed(1)}% |`);
			sections.push(`| Avg Duration | ${stats.avgDuration}ms |`);
			sections.push(`| P95 Duration | ${stats.p95Duration}ms |`);
			sections.push("");
		}

		// Workflow structure
		sections.push("### Workflow Structure");
		sections.push("");
		sections.push("```json");
		sections.push(JSON.stringify(workflow, null, 2));
		sections.push("```");
		sections.push("");

		// Footer
		sections.push("---");
		sections.push("");
		sections.push("*This PR was automatically created by an AI agent.*");
		if (metadata.agent) {
			sections.push(`*Agent: ${metadata.agent}*`);
		}
		sections.push("");
		sections.push("Please review the workflow structure and approve if it looks good.");

		return sections.join("\n");
	}

	/**
	 * Calculate match confidence for workflow search
	 */
	private calculateMatchConfidence(workflow: WorkflowDefinition, query: WorkflowSearchQuery): number {
		let confidence = 0;
		let factors = 0;

		// Match task description
		if (query.task) {
			const taskLower = query.task.toLowerCase();
			const nameLower = (workflow.name || "").toLowerCase();
			const descLower = (workflow.description || "").toLowerCase();
			const idLower = workflow.id.toLowerCase();

			if (nameLower.includes(taskLower) || taskLower.includes(nameLower)) {
				confidence += 0.4;
			} else if (descLower.includes(taskLower) || taskLower.includes(descLower)) {
				confidence += 0.3;
			} else if (idLower.includes(taskLower) || taskLower.includes(idLower)) {
				confidence += 0.2;
			}
			factors++;
		}

		// Match tags
		if (query.tags && query.tags.length > 0 && workflow.metadata?.tags) {
			const workflowTags = workflow.metadata.tags as string[];
			const matchedTags = query.tags.filter((tag) => workflowTags.includes(tag));
			if (matchedTags.length > 0) {
				confidence += (matchedTags.length / query.tags.length) * 0.3;
			}
			factors++;
		}

		return factors > 0 ? confidence / factors : 0;
	}

	/**
	 * Generate match reason for search result
	 */
	private generateMatchReason(workflow: WorkflowDefinition, query: WorkflowSearchQuery): string {
		const reasons: string[] = [];

		if (query.task) {
			if ((workflow.name || "").toLowerCase().includes(query.task.toLowerCase())) {
				reasons.push("Name matches task");
			} else if ((workflow.description || "").toLowerCase().includes(query.task.toLowerCase())) {
				reasons.push("Description matches task");
			}
		}

		if (query.tags && workflow.metadata?.tags) {
			const workflowTags = workflow.metadata.tags as string[];
			const matched = query.tags.filter((tag) => workflowTags.includes(tag));
			if (matched.length > 0) {
				reasons.push(`Tags match: ${matched.join(", ")}`);
			}
		}

		return reasons.length > 0 ? reasons.join("; ") : "Partial match";
	}
}
