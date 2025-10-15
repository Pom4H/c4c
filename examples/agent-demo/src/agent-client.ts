/**
 * Simulated AI Agent Client
 * Demonstrates how an AI agent would interact with tsdev
 */

import type { WorkflowDefinition } from "@tsdev/workflow";

const API_URL = process.env.API_URL || "http://localhost:3000";
const AGENT_ID = "demo-agent-1";

/**
 * Simulated AI agent that handles tasks
 */
class AIAgent {
	constructor(
		private apiUrl: string,
		private agentId: string,
	) {}

	/**
	 * Main entry point: Agent receives a task
	 */
	async handleTask(task: string, input: Record<string, unknown> = {}) {
		console.log(`\n🤖 [${this.agentId}] Received task: "${task}"`);

		// 1. Search for existing workflow
		console.log("   🔍 Searching for existing workflow...");
		const existingWorkflow = await this.searchWorkflow(task);

		let workflow: WorkflowDefinition;

		if (existingWorkflow) {
			console.log(`   ✓ Found workflow: ${existingWorkflow.id}`);
			workflow = existingWorkflow;
		} else {
			console.log("   ℹ No existing workflow found");
			console.log("   🧠 Composing new workflow...");

			// 2. Agent composes new workflow based on task
			workflow = this.composeWorkflow(task);
			console.log(`   ✓ Composed workflow: ${workflow.id}`);
		}

		// 3. Execute task via agent API
		console.log("   ⚡ Executing workflow...");
		const result = await this.executeTask(task, workflow, input);

		// 4. Display results
		console.log(`\n   ✅ Execution ${result.execution.status}`);
		console.log(`   📊 Execution time: ${result.execution.executionTime}ms`);
		console.log(`   📝 Nodes executed: ${result.execution.nodesExecuted.join(" → ")}`);

		if (result.improvements && result.improvements.length > 0) {
			console.log(`\n   💡 Improvements suggested:`);
			for (const improvement of result.improvements) {
				console.log(`      - ${improvement.type}: ${improvement.reason}`);
				if (improvement.expectedImpact) {
					console.log(`        Impact: ${improvement.expectedImpact}`);
				}
			}
		}

		if (result.pr) {
			console.log(`\n   🔗 Pull Request created:`);
			console.log(`      ${result.pr.url}`);
		}

		return result;
	}

	/**
	 * Search for workflow matching task
	 */
	private async searchWorkflow(task: string): Promise<WorkflowDefinition | null> {
		try {
			const response = await fetch(
				`${this.apiUrl}/agent/workflow/search?task=${encodeURIComponent(task)}`,
			);

			if (!response.ok) {
				return null;
			}

			const data = await response.json();
			return data.workflow || null;
		} catch (error) {
			console.error("   ⚠️  Search failed:", error);
			return null;
		}
	}

	/**
	 * Execute task via agent API
	 */
	private async executeTask(
		task: string,
		workflow: WorkflowDefinition,
		input: Record<string, unknown>,
	) {
		const response = await fetch(`${this.apiUrl}/agent/task`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				task,
				workflow,
				input,
				options: {
					minConfidence: 0.6,
					autoImprove: true,
					agentId: this.agentId,
				},
			}),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(`Task execution failed: ${error.error}`);
		}

		return await response.json();
	}

	/**
	 * Compose workflow based on task
	 * This is where AI agent's intelligence comes in
	 */
	private composeWorkflow(task: string): WorkflowDefinition {
		const taskLower = task.toLowerCase();

		// Simple rule-based composition (real AI would use LLM)
		if (taskLower.includes("onboard") || taskLower.includes("user")) {
			return this.composeUserOnboardingWorkflow();
		}

		// Default simple workflow
		return {
			id: `task-${Date.now()}`,
			name: `Workflow for: ${task}`,
			version: "1.0.0",
			startNode: "step-1",
			nodes: [
				{
					id: "step-1",
					type: "procedure",
					procedureName: "users.create",
					config: {},
				},
			],
		};
	}

	/**
	 * Compose user onboarding workflow
	 */
	private composeUserOnboardingWorkflow(): WorkflowDefinition {
		return {
			id: "user-onboarding",
			name: "User Onboarding Flow",
			description: "Complete user registration with email and analytics",
			version: "1.0.0",
			startNode: "create-user",
			nodes: [
				{
					id: "create-user",
					type: "procedure",
					procedureName: "users.create",
					config: {},
					next: "send-welcome",
				},
				{
					id: "send-welcome",
					type: "procedure",
					procedureName: "emails.sendWelcome",
					config: {
						userId: "{{ createUser.id }}",
						email: "{{ createUser.email }}",
						name: "{{ createUser.name }}",
					},
					next: "track-signup",
				},
				{
					id: "track-signup",
					type: "procedure",
					procedureName: "analytics.track",
					config: {
						event: "user.signup",
						userId: "{{ createUser.id }}",
						properties: {
							source: "demo",
						},
					},
				},
			],
			metadata: {
				tags: ["onboarding", "users"],
			},
		};
	}
}

/**
 * Demo scenarios
 */
async function runDemo() {
	const agent = new AIAgent(API_URL, AGENT_ID);

	console.log("=" .repeat(60));
	console.log("🤖 AI Agent Demo");
	console.log("=" .repeat(60));

	try {
		// Scenario 1: Onboard new user
		await agent.handleTask("Onboard new user", {
			name: "Alice Johnson",
			email: "alice@example.com",
		});

		console.log("\n" + "─".repeat(60) + "\n");

		// Wait a bit
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Scenario 2: Same task again (should reuse workflow)
		await agent.handleTask("Onboard another user", {
			name: "Bob Smith",
			email: "bob@example.com",
		});

		console.log("\n" + "=".repeat(60));
		console.log("✅ Demo completed successfully!");
		console.log("=" .repeat(60));
	} catch (error) {
		console.error("\n❌ Demo failed:", error);
		process.exit(1);
	}
}

// Run demo
runDemo();
