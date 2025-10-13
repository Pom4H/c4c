/**
 * Example demonstrating OpenTelemetry tracing in workflows
 * 
 * Shows the span hierarchy created during workflow execution
 */

import type { WorkflowDefinition } from "./types.js";

/**
 * Example workflow that demonstrates telemetry
 * 
 * Span Hierarchy:
 * 
 * workflow.execute (root span)
 *   ├─ attributes:
 *   │  ├─ workflow.id: "user-onboarding"
 *   │  ├─ workflow.name: "User Onboarding"
 *   │  ├─ workflow.execution_id: "wf_exec_..."
 *   │  └─ workflow.nodes_executed_total: 3
 *   │
 *   ├─ workflow.node.procedure (create user)
 *   │  ├─ attributes:
 *   │  │  ├─ node.id: "create-user"
 *   │  │  ├─ node.type: "procedure"
 *   │  │  └─ node.procedure: "users.create"
 *   │  │
 *   │  └─ users.create (procedure span from withSpan policy)
 *   │     ├─ attributes:
 *   │     │  ├─ request.id: "req_..."
 *   │     │  ├─ context.transport: "workflow"
 *   │     │  ├─ context.workflowId: "user-onboarding"
 *   │     │  └─ context.nodeId: "create-user"
 *   │     │
 *   │     └─ [business logic execution]
 *   │
 *   ├─ workflow.node.condition (check email verified)
 *   │  ├─ attributes:
 *   │  │  ├─ node.id: "check-verified"
 *   │  │  ├─ node.type: "condition"
 *   │  │  ├─ condition.expression: "emailVerified === true"
 *   │  │  ├─ condition.result: true
 *   │  │  └─ condition.branch_taken: "send-welcome"
 *   │  │
 *   │  └─ [condition evaluation]
 *   │
 *   └─ workflow.node.procedure (send welcome email)
 *      ├─ attributes:
 *      │  ├─ node.id: "send-welcome"
 *      │  ├─ node.type: "procedure"
 *      │  └─ node.procedure: "emails.send"
 *      │
 *      └─ emails.send (procedure span from withSpan policy)
 *         ├─ attributes:
 *         │  ├─ request.id: "req_..."
 *         │  ├─ context.transport: "workflow"
 *         │  └─ context.workflowId: "user-onboarding"
 *         │
 *         └─ [email sending logic]
 */
export const telemetryExampleWorkflow: WorkflowDefinition = {
	id: "user-onboarding-telemetry",
	name: "User Onboarding with Telemetry",
	description: "Demonstrates full OpenTelemetry integration",
	version: "1.0.0",
	startNode: "create-user",
	variables: {
		emailVerified: true,
	},
	nodes: [
		{
			id: "create-user",
			type: "procedure",
			procedureName: "users.create",
			config: {},
			next: "check-verified",
		},
		{
			id: "check-verified",
			type: "condition",
			config: {
				expression: "emailVerified === true",
				trueBranch: "send-welcome",
				falseBranch: "send-verification",
			},
		},
		{
			id: "send-welcome",
			type: "procedure",
			procedureName: "emails.send",
			config: {
				template: "welcome",
			},
			next: undefined,
		},
		{
			id: "send-verification",
			type: "procedure",
			procedureName: "emails.send",
			config: {
				template: "verify-email",
			},
			next: undefined,
		},
	],
	metadata: {
		tags: ["users", "onboarding", "telemetry-example"],
		description: "Full tracing example with nested spans",
	},
};

/**
 * Example trace output (JSON format for Jaeger/Zipkin):
 * 
 * {
 *   "traceId": "abc123...",
 *   "spans": [
 *     {
 *       "spanId": "span-1",
 *       "name": "workflow.execute",
 *       "attributes": {
 *         "workflow.id": "user-onboarding-telemetry",
 *         "workflow.name": "User Onboarding with Telemetry",
 *         "workflow.status": "completed",
 *         "workflow.nodes_executed_total": 3,
 *         "workflow.execution_time_ms": 1234
 *       },
 *       "children": ["span-2", "span-4", "span-6"]
 *     },
 *     {
 *       "spanId": "span-2",
 *       "parentId": "span-1",
 *       "name": "workflow.node.procedure",
 *       "attributes": {
 *         "node.id": "create-user",
 *         "node.type": "procedure",
 *         "node.procedure": "users.create",
 *         "node.status": "completed"
 *       },
 *       "children": ["span-3"]
 *     },
 *     {
 *       "spanId": "span-3",
 *       "parentId": "span-2",
 *       "name": "users.create",
 *       "attributes": {
 *         "request.id": "req_...",
 *         "context.transport": "workflow",
 *         "context.workflowId": "user-onboarding-telemetry",
 *         "context.nodeId": "create-user"
 *       }
 *     },
 *     {
 *       "spanId": "span-4",
 *       "parentId": "span-1",
 *       "name": "workflow.node.condition",
 *       "attributes": {
 *         "node.id": "check-verified",
 *         "condition.expression": "emailVerified === true",
 *         "condition.result": true,
 *         "condition.branch_taken": "send-welcome"
 *       }
 *     },
 *     {
 *       "spanId": "span-6",
 *       "parentId": "span-1",
 *       "name": "workflow.node.procedure",
 *       "attributes": {
 *         "node.id": "send-welcome",
 *         "node.procedure": "emails.send"
 *       },
 *       "children": ["span-7"]
 *     },
 *     {
 *       "spanId": "span-7",
 *       "parentId": "span-6",
 *       "name": "emails.send",
 *       "attributes": {
 *         "context.transport": "workflow",
 *         "email.template": "welcome"
 *       }
 *     }
 *   ]
 * }
 */

/**
 * Benefits of integrated telemetry:
 * 
 * 1. Full visibility into workflow execution
 *    - See entire workflow as one trace
 *    - Track execution time of each node
 *    - Identify bottlenecks
 * 
 * 2. Procedure-level tracing
 *    - Each procedure creates its own span
 *    - Policies (withSpan, withRetry) add their spans
 *    - Full hierarchy preserved
 * 
 * 3. Business context in traces
 *    - workflow.id, execution_id
 *    - node.id, procedure names
 *    - Input/output data
 *    - Condition expressions and results
 * 
 * 4. Error tracking
 *    - Failed nodes marked in traces
 *    - Error messages captured
 *    - Stack traces preserved
 *    - Error handler paths visible
 * 
 * 5. Parallel execution visibility
 *    - See all parallel branches
 *    - Track which completed first
 *    - Identify slow branches
 * 
 * 6. Compatible with all observability tools
 *    - Jaeger
 *    - Zipkin
 *    - DataDog
 *    - New Relic
 *    - Honeycomb
 *    - etc.
 */
