/**
 * Example workflows demonstrating the workflow system
 */

import type { WorkflowDefinition } from "../core/workflow/types.js";

/**
 * Simple user registration workflow
 * 
 * Flow:
 * 1. Create user
 * 2. Send welcome email (parallel with profile setup)
 * 3. Setup user profile
 */
export const userRegistrationWorkflow: WorkflowDefinition = {
	id: "user-registration",
	name: "User Registration Workflow",
	description: "Complete user registration process",
	version: "1.0.0",
	startNode: "create-user",
	variables: {},
	nodes: [
		{
			id: "create-user",
			type: "procedure",
			procedureName: "users.create",
			config: {
				// Initial input - will be merged with workflow input
			},
			next: "welcome-email",
		},
		{
			id: "welcome-email",
			type: "procedure",
			procedureName: "emails.send", // Would need to implement this
			config: {
				template: "welcome",
			},
			next: undefined, // End of workflow
		},
	],
	metadata: {
		tags: ["users", "registration"],
		author: "tsdev",
	},
};

/**
 * Data processing pipeline workflow
 * 
 * Flow:
 * 1. Fetch user data
 * 2. Check if user is premium
 * 3a. If premium: advanced processing
 * 3b. If not premium: basic processing
 * 4. Save results
 */
export const dataProcessingWorkflow: WorkflowDefinition = {
	id: "data-processing",
	name: "Data Processing Pipeline",
	description: "Process user data based on subscription tier",
	version: "1.0.0",
	startNode: "fetch-user",
	variables: {},
	nodes: [
		{
			id: "fetch-user",
			type: "procedure",
			procedureName: "users.get",
			next: "check-premium",
		},
		{
			id: "check-premium",
			type: "condition",
			config: {
				expression: "subscription === 'premium'",
				trueBranch: "advanced-processing",
				falseBranch: "basic-processing",
			},
		},
		{
			id: "advanced-processing",
			type: "procedure",
			procedureName: "analytics.advanced", // Would need to implement
			next: "save-results",
		},
		{
			id: "basic-processing",
			type: "procedure",
			procedureName: "analytics.basic", // Would need to implement
			next: "save-results",
		},
		{
			id: "save-results",
			type: "procedure",
			procedureName: "storage.save", // Would need to implement
			next: undefined,
		},
	],
};

/**
 * Parallel task execution workflow
 * 
 * Flow:
 * 1. Start multiple tasks in parallel
 * 2. Wait for all to complete
 * 3. Aggregate results
 */
export const parallelTasksWorkflow: WorkflowDefinition = {
	id: "parallel-tasks",
	name: "Parallel Tasks Workflow",
	description: "Execute multiple tasks simultaneously",
	version: "1.0.0",
	startNode: "parallel-execution",
	variables: {},
	nodes: [
		{
			id: "parallel-execution",
			type: "parallel",
			config: {
				branches: ["task-1", "task-2", "task-3"],
				waitForAll: true,
			},
			next: "aggregate-results",
		},
		{
			id: "task-1",
			type: "procedure",
			procedureName: "math.add",
			config: { a: 1, b: 2 },
		},
		{
			id: "task-2",
			type: "procedure",
			procedureName: "math.multiply",
			config: { a: 3, b: 4 },
		},
		{
			id: "task-3",
			type: "procedure",
			procedureName: "math.add",
			config: { a: 5, b: 6 },
		},
		{
			id: "aggregate-results",
			type: "procedure",
			procedureName: "math.add", // Sum all results
			next: undefined,
		},
	],
};

/**
 * Error handling workflow
 * 
 * Flow:
 * 1. Try to execute procedure
 * 2. If error, execute error handler
 * 3. Continue or stop based on error severity
 */
export const errorHandlingWorkflow: WorkflowDefinition = {
	id: "error-handling",
	name: "Error Handling Workflow",
	description: "Demonstrates error handling in workflows",
	version: "1.0.0",
	startNode: "risky-operation",
	variables: {},
	nodes: [
		{
			id: "risky-operation",
			type: "procedure",
			procedureName: "users.create",
			onError: "error-handler",
			next: "success-handler",
		},
		{
			id: "error-handler",
			type: "procedure",
			procedureName: "logging.error", // Would need to implement
			next: "check-retry",
		},
		{
			id: "check-retry",
			type: "condition",
			config: {
				expression: "retryCount < 3",
				trueBranch: "risky-operation",
				falseBranch: "give-up",
			},
		},
		{
			id: "success-handler",
			type: "procedure",
			procedureName: "logging.success", // Would need to implement
			next: undefined,
		},
		{
			id: "give-up",
			type: "procedure",
			procedureName: "logging.fatal", // Would need to implement
			next: undefined,
		},
	],
};

/**
 * Simple math calculation workflow (works with current procedures!)
 */
export const mathCalculationWorkflow: WorkflowDefinition = {
	id: "math-calculation",
	name: "Math Calculation Workflow",
	description: "Chain math operations",
	version: "1.0.0",
	startNode: "add-numbers",
	variables: {
		a: 10,
		b: 5,
	},
	nodes: [
		{
			id: "add-numbers",
			type: "procedure",
			procedureName: "math.add",
			config: {
				a: 10,
				b: 5,
			},
			next: "multiply-result",
		},
		{
			id: "multiply-result",
			type: "procedure",
			procedureName: "math.multiply",
			config: {
				a: 2, // Will use result from previous step
				// b will come from previous step's output
			},
			next: undefined,
		},
	],
	metadata: {
		tags: ["math", "demo"],
	},
};
