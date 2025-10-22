/**
 * API Route: POST /api/workflow/execute
 * Запускает workflow execution
 */

import { NextResponse } from "next/server";
import { executeWorkflow, type WorkflowDefinition } from "@c4c/workflow";
import { collectRegistry } from "@c4c/core";
import {
	googleDriveMonitor,
	slackBot,
	complexTriggerWorkflow,
} from "@/../../examples/integrations/workflows/trigger-example";

const workflowsMap: Record<string, WorkflowDefinition> = {
	"google-drive-monitor": googleDriveMonitor as WorkflowDefinition,
	"slack-bot": slackBot as WorkflowDefinition,
	"complex-trigger-workflow": complexTriggerWorkflow as WorkflowDefinition,
};

export async function POST(request: Request) {
	try {
		const { workflowId, input, options } = await request.json();

		const workflow = workflowsMap[workflowId];
		if (!workflow) {
			return NextResponse.json(
				{ error: "Workflow not found" },
				{ status: 404 }
			);
		}

		// Load registry (в production кешировать)
		const registry = await collectRegistry("./procedures");

		// Execute workflow
		const result = await executeWorkflow(
			workflow,
			registry,
			input || {},
			options
		);

		// Return serialized result
		return NextResponse.json({
			executionId: result.executionId,
			status: result.status,
			outputs: result.outputs,
			executionTime: result.executionTime,
			nodesExecuted: result.nodesExecuted,
			error: result.error
				? {
						message: result.error.message,
						name: result.error.name,
						stack: result.error.stack,
				  }
				: undefined,
			spans: result.spans,
		});
	} catch (error) {
		console.error("Failed to execute workflow:", error);
		return NextResponse.json(
			{
				error: "Failed to execute workflow",
				message: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
