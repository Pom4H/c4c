/**
 * API Route: GET /api/workflow/definitions/[id]
 * Возвращает definition конкретного workflow
 */

import { NextResponse } from "next/server";
import type { WorkflowDefinition } from "@c4c/workflow";
import {
	googleDriveMonitor,
	slackBot,
	complexTriggerWorkflow,
} from "@/../../examples/integrations/workflows/trigger-example";

// Mock workflows - в production загружать из БД
const workflowsMap: Record<string, WorkflowDefinition> = {
	"google-drive-monitor": googleDriveMonitor as WorkflowDefinition,
	"slack-bot": slackBot as WorkflowDefinition,
	"complex-trigger-workflow": complexTriggerWorkflow as WorkflowDefinition,
};

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const workflow = workflowsMap[id];

	if (!workflow) {
		return NextResponse.json(
			{ error: "Workflow not found" },
			{ status: 404 }
		);
	}

	return NextResponse.json(workflow);
}
