/**
 * Agent demo server
 * HTTP server with AI agent endpoints and git integration
 */

import { collectRegistry } from "@tsdev/core";
import { createHttpServer, initializeAgentManager } from "@tsdev/adapters";
import type { GitConfig } from "@tsdev/git";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
	console.log("🤖 Starting Agent Demo Server...\n");

	// 1. Collect procedures
	console.log("📦 Collecting procedures...");
	const registry = await collectRegistry(path.join(__dirname, "handlers"));
	console.log(`✓ Found ${registry.size} procedures\n`);

	// 2. Configure Git
	const gitConfig: GitConfig = {
		repoPath: process.env.GIT_REPO_PATH || path.join(__dirname, ".."),
		defaultBranch: process.env.GIT_DEFAULT_BRANCH || "main",
		workflowsDir: process.env.GIT_WORKFLOWS_DIR || "workflows",
		githubToken: process.env.GITHUB_TOKEN,
		githubRepo: process.env.GITHUB_REPO,
	};

	console.log("⚙️  Git Configuration:");
	console.log(`   Repo: ${gitConfig.repoPath}`);
	console.log(`   Branch: ${gitConfig.defaultBranch}`);
	console.log(`   Workflows: ${gitConfig.workflowsDir}/`);
	console.log(`   GitHub: ${gitConfig.githubRepo || "Not configured"}\n`);

	// 3. Initialize agent manager
	console.log("🤖 Initializing Agent Manager...");
	initializeAgentManager(gitConfig, registry);
	console.log("✓ Agent Manager ready\n");

	// 4. Create HTTP server
	const port = parseInt(process.env.PORT || "3000", 10);
	createHttpServer(registry, port);
}

main().catch((error) => {
	console.error("Failed to start server:", error);
	process.exit(1);
});
