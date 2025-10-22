/**
 * Simple Demo Workflow - uses math and data procedures
 * Can be executed immediately without external dependencies
 */

import type { WorkflowDefinition } from "@c4c/workflow";

/**
 * Simple Math Workflow
 * Demonstrates basic sequential execution with math operations
 */
export const simpleMathWorkflow: WorkflowDefinition = {
	id: "simple-math-workflow",
	name: "Simple Math Workflow",
	description: "Basic math operations workflow for testing",
	version: "1.0.0",
	
	startNode: "add",
	
	nodes: [
		{
			id: "add",
			type: "procedure",
			procedureName: "math.add",
			config: {
				a: 10,
				b: 5,
			},
			next: "multiply",
		},
		{
			id: "multiply",
			type: "procedure",
			procedureName: "math.multiply",
			config: {
				a: 3,
				b: 2,
			},
			next: "subtract",
		},
		{
			id: "subtract",
			type: "procedure",
			procedureName: "math.subtract",
			config: {
				a: 20,
				b: 8,
			},
		},
	],
};

/**
 * Data Processing Workflow
 * Demonstrates condition nodes and parallel execution
 */
export const dataProcessingWorkflow: WorkflowDefinition = {
	id: "data-processing-workflow",
	name: "Data Processing Workflow",
	description: "Fetch, process, and save data with conditional logic",
	version: "1.0.0",
	
	startNode: "fetch-user",
	
	nodes: [
		{
			id: "fetch-user",
			type: "procedure",
			procedureName: "data.fetch",
			config: {
				userId: "user123",
			},
			next: "check-premium",
		},
		{
			id: "check-premium",
			type: "condition",
			config: {
				expression: "isPremium === true",
				trueBranch: "process-premium",
				falseBranch: "process-basic",
			},
		},
		{
			id: "process-premium",
			type: "procedure",
			procedureName: "data.process",
			config: {
				mode: "premium",
			},
			next: "save-data",
		},
		{
			id: "process-basic",
			type: "procedure",
			procedureName: "data.process",
			config: {
				mode: "basic",
			},
			next: "save-data",
		},
		{
			id: "save-data",
			type: "procedure",
			procedureName: "data.save",
			config: {
				payload: {},
			},
		},
	],
};

/**
 * Complex Workflow with Parallel Execution
 * Demonstrates parallel node execution
 */
export const parallelWorkflow: WorkflowDefinition = {
	id: "parallel-workflow",
	name: "Parallel Execution Workflow",
	description: "Executes multiple branches in parallel",
	version: "1.0.0",
	
	startNode: "start",
	
	nodes: [
		{
			id: "start",
			type: "procedure",
			procedureName: "data.fetch",
			config: {
				userId: "user456",
			},
			next: "parallel-processing",
		},
		{
			id: "parallel-processing",
			type: "parallel",
			config: {
				branches: ["math-branch", "data-branch"],
				waitForAll: true,
			},
			next: "finalize",
		},
		{
			id: "math-branch",
			type: "procedure",
			procedureName: "math.add",
			config: {
				a: 100,
				b: 50,
			},
		},
		{
			id: "data-branch",
			type: "procedure",
			procedureName: "data.process",
			config: {
				mode: "enterprise",
			},
		},
		{
			id: "finalize",
			type: "procedure",
			procedureName: "data.save",
			config: {},
		},
	],
};

/**
 * Logging Workflow - uses custom procedures
 * Tests custom.log procedure
 */
export const loggingWorkflow: WorkflowDefinition = {
	id: "logging-workflow",
	name: "Logging Workflow",
	description: "Demonstrates custom logging procedures",
	version: "1.0.0",
	
	startNode: "log-start",
	
	nodes: [
		{
			id: "log-start",
			type: "procedure",
			procedureName: "custom.log",
			config: {
				message: "Workflow started",
				level: "info",
			},
			next: "do-math",
		},
		{
			id: "do-math",
			type: "procedure",
			procedureName: "math.add",
			config: {
				a: 5,
				b: 3,
			},
			next: "log-result",
		},
		{
			id: "log-result",
			type: "procedure",
			procedureName: "custom.log",
			config: {
				message: "Math operation completed",
				level: "info",
			},
		},
	],
};

/**
 * Long Running Workflow - ~1 minute execution time
 * Perfect for watching real-time updates in UI
 */
export const longRunningWorkflow: WorkflowDefinition = {
	id: "long-running-workflow",
	name: "Long Running Workflow (1 minute)",
	description: "Demonstrates real-time updates with delays - takes about 1 minute to complete",
	version: "1.0.0",
	
	startNode: "start",
	
	nodes: [
		{
			id: "start",
			type: "procedure",
			procedureName: "custom.log",
			config: {
				message: "🚀 Starting long-running workflow...",
				level: "info",
			},
			next: "phase-1",
		},
		{
			id: "phase-1",
			type: "procedure",
			procedureName: "custom.delay",
			config: {
				seconds: 10,
				message: "⏳ Phase 1: Initializing (10 seconds)...",
			},
			next: "fetch-data",
		},
		{
			id: "fetch-data",
			type: "procedure",
			procedureName: "data.fetch",
			config: {
				userId: "demo-user-123",
			},
			next: "phase-2",
		},
		{
			id: "phase-2",
			type: "procedure",
			procedureName: "custom.delay",
			config: {
				seconds: 15,
				message: "⏳ Phase 2: Processing data (15 seconds)...",
			},
			next: "parallel-tasks",
		},
		{
			id: "parallel-tasks",
			type: "parallel",
			config: {
				branches: ["compute-branch", "io-branch"],
				waitForAll: true,
			},
			next: "phase-3",
		},
		{
			id: "compute-branch",
			type: "procedure",
			procedureName: "custom.heavyComputation",
			config: {
				iterations: 500000,
				label: "💻 Computing analytics...",
			},
		},
		{
			id: "io-branch",
			type: "procedure",
			procedureName: "custom.delay",
			config: {
				seconds: 12,
				message: "💾 Saving to database...",
			},
		},
		{
			id: "phase-3",
			type: "procedure",
			procedureName: "custom.delay",
			config: {
				seconds: 10,
				message: "⏳ Phase 3: Finalizing (10 seconds)...",
			},
			next: "send-notification",
		},
		{
			id: "send-notification",
			type: "procedure",
			procedureName: "custom.sendNotification",
			config: {
				message: "✅ Long-running workflow completed successfully!",
				channel: "slack",
			},
			next: "complete",
		},
		{
			id: "complete",
			type: "procedure",
			procedureName: "custom.log",
			config: {
				message: "🎉 Workflow completed! Total time: ~1 minute",
				level: "info",
			},
		},
	],
};

/**
 * Very Long Workflow - ~2 minutes execution time
 * For extended real-time monitoring
 */
export const veryLongWorkflow: WorkflowDefinition = {
	id: "very-long-workflow",
	name: "Very Long Workflow (2 minutes)",
	description: "Extended workflow for testing - takes about 2 minutes to complete",
	version: "1.0.0",
	
	startNode: "start",
	
	nodes: [
		{
			id: "start",
			type: "procedure",
			procedureName: "custom.log",
			config: {
				message: "🚀 Starting very long workflow (2 minutes)...",
				level: "info",
			},
			next: "stage-1",
		},
		{
			id: "stage-1",
			type: "procedure",
			procedureName: "custom.delay",
			config: {
				seconds: 20,
				message: "⏳ Stage 1/6: Setup (20 seconds)...",
			},
			next: "stage-2",
		},
		{
			id: "stage-2",
			type: "procedure",
			procedureName: "custom.delay",
			config: {
				seconds: 20,
				message: "⏳ Stage 2/6: Data Collection (20 seconds)...",
			},
			next: "stage-3",
		},
		{
			id: "stage-3",
			type: "procedure",
			procedureName: "custom.heavyComputation",
			config: {
				iterations: 800000,
				label: "💻 Stage 3/6: Heavy Processing...",
			},
			next: "stage-4",
		},
		{
			id: "stage-4",
			type: "procedure",
			procedureName: "custom.delay",
			config: {
				seconds: 20,
				message: "⏳ Stage 4/6: Validation (20 seconds)...",
			},
			next: "stage-5-parallel",
		},
		{
			id: "stage-5-parallel",
			type: "parallel",
			config: {
				branches: ["parallel-task-1", "parallel-task-2", "parallel-task-3"],
				waitForAll: true,
			},
			next: "stage-6",
		},
		{
			id: "parallel-task-1",
			type: "procedure",
			procedureName: "custom.delay",
			config: {
				seconds: 15,
				message: "📊 Task A: Analytics (15s)...",
			},
		},
		{
			id: "parallel-task-2",
			type: "procedure",
			procedureName: "custom.delay",
			config: {
				seconds: 15,
				message: "💾 Task B: Backup (15s)...",
			},
		},
		{
			id: "parallel-task-3",
			type: "procedure",
			procedureName: "custom.delay",
			config: {
				seconds: 15,
				message: "📧 Task C: Notifications (15s)...",
			},
		},
		{
			id: "stage-6",
			type: "procedure",
			procedureName: "custom.delay",
			config: {
				seconds: 15,
				message: "⏳ Stage 6/6: Cleanup (15 seconds)...",
			},
			next: "complete",
		},
		{
			id: "complete",
			type: "procedure",
			procedureName: "custom.log",
			config: {
				message: "🎉 Very long workflow completed! Total time: ~2 minutes",
				level: "info",
			},
		},
	],
};
