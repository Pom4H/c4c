/**
 * Types for Git and GitHub integration
 */

import type { WorkflowDefinition } from "@tsdev/workflow";

/**
 * Git configuration for workflow storage
 */
export interface GitConfig {
	/** Path to git repository */
	repoPath: string;
	/** Default branch (e.g., "main") */
	defaultBranch: string;
	/** Directory for workflows (e.g., "workflows") */
	workflowsDir: string;
	/** GitHub token for API access (optional) */
	githubToken?: string;
	/** GitHub repository (e.g., "owner/repo") */
	githubRepo?: string;
}

/**
 * Result of workflow save operation
 */
export interface WorkflowSaveResult {
	/** Workflow ID */
	workflowId: string;
	/** Git branch created */
	branch: string;
	/** Commit SHA */
	commitSha: string;
	/** Pull request URL (if created) */
	prUrl?: string;
	/** Pull request number */
	prNumber?: number;
}

/**
 * Workflow improvement suggestion
 */
export interface WorkflowImprovement {
	/** Type of improvement */
	type: "add-retry" | "add-cache" | "parallelize" | "add-error-handling" | "optimize";
	/** Affected node IDs */
	nodes: string[];
	/** Reason for improvement */
	reason: string;
	/** Expected impact */
	expectedImpact?: string;
	/** Confidence score (0-1) */
	confidence?: number;
}

/**
 * Metadata for workflow commits
 */
export interface WorkflowCommitMetadata {
	/** Task description that triggered workflow creation */
	task?: string;
	/** Improvements applied */
	improvements?: WorkflowImprovement[];
	/** Execution statistics */
	executionStats?: {
		totalExecutions: number;
		successRate: number;
		avgDuration: number;
		p95Duration: number;
	};
	/** Agent identifier */
	agent?: string;
}

/**
 * Options for creating a pull request
 */
export interface CreatePROptions {
	/** PR title */
	title: string;
	/** PR body/description */
	body: string;
	/** Create as draft PR */
	draft?: boolean;
	/** Labels to add */
	labels?: string[];
	/** Reviewers to assign */
	reviewers?: string[];
}

/**
 * Workflow search query
 */
export interface WorkflowSearchQuery {
	/** Task description */
	task?: string;
	/** Tags to match */
	tags?: string[];
	/** Minimum confidence threshold */
	minConfidence?: number;
}

/**
 * Workflow match result
 */
export interface WorkflowMatch {
	/** Workflow definition */
	workflow: WorkflowDefinition;
	/** Match confidence score (0-1) */
	confidence: number;
	/** File path in git */
	filePath: string;
	/** Reason for match */
	matchReason: string;
}
