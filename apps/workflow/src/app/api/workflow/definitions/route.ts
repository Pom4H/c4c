/**
 * API Route: GET /api/workflow/definitions
 * Возвращает список доступных workflow definitions
 */

import { NextResponse } from "next/server";

// Mock workflows for now - в production загружать из БД или файлов
const workflows = [
	{
		id: "google-drive-monitor",
		name: "Google Drive Monitor",
		nodeCount: 4,
	},
	{
		id: "slack-bot",
		name: "Slack Bot",
		nodeCount: 5,
	},
	{
		id: "complex-trigger-workflow",
		name: "Complex Trigger Workflow",
		nodeCount: 7,
	},
];

export async function GET() {
	return NextResponse.json(workflows);
}
