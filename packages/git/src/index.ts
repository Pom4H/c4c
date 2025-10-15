/**
 * @tsdev/git
 * Git and GitHub integration for AI agents managing workflows
 */

export { GitWorkflowStorage } from "./storage.js";
export { AgentWorkflowManager } from "./agent-manager.js";
export { WorkflowOptimizer } from "./optimizer.js";

export type {
	GitConfig,
	WorkflowSaveResult,
	WorkflowImprovement,
	WorkflowCommitMetadata,
	CreatePROptions,
	WorkflowSearchQuery,
	WorkflowMatch,
} from "./types.js";

export type { AgentTaskOptions, AgentTaskResult } from "./agent-manager.js";
