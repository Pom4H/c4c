/**
 * API Route: GET /api/workflow/definitions/[id]
 * Возвращает definition конкретного workflow
 */

import { NextResponse } from "next/server";
import {
	googleDriveMonitor,
	slackBot,
	complexTriggerWorkflow,
} from "@/../../examples/integrations/workflows/trigger-example";

// Mock workflows - в production загружать из БД
const workflowsMap: Record<string, any> = {
	"google-drive-monitor": googleDriveMonitor,
	"slack-bot": slackBot,
	"complex-trigger-workflow": complexTriggerWorkflow,
};

export async function GET(
	request: Request,
	{ params }: { params: { id: string } }
) {
	const workflow = workflowsMap[params.id];

	if (!workflow) {
		return NextResponse.json(
			{ error: "Workflow not found" },
			{ status: 404 }
		);
	}

	return NextResponse.json(workflow);
}
