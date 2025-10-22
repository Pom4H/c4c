/**
 * API Route: GET /api/workflow/executions
 * Возвращает список всех executions
 */

import { NextResponse } from "next/server";
import { getExecutionStore } from "@c4c/workflow";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const store = getExecutionStore();
		const executions = store.getAllExecutionsJSON();
		const stats = store.getStats();

		return NextResponse.json({
			executions,
			stats,
		});
	} catch (error) {
		console.error("Failed to get executions:", error);
		return NextResponse.json(
			{ error: "Failed to get executions" },
			{ status: 500 }
		);
	}
}
