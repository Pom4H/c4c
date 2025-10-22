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
