/**
 * API Route: GET /api/workflow/executions/[id]
 * Возвращает детали конкретного execution
 */

import { NextResponse } from "next/server";
import { getExecutionStore } from "@c4c/workflow";

export const dynamic = "force-dynamic";

export async function GET(
	request: Request,
	{ params }: { params: { id: string } }
) {
	try {
		const store = getExecutionStore();
		const execution = store.getExecutionJSON(params.id);

		if (!execution) {
			return NextResponse.json(
				{ error: "Execution not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json(execution);
	} catch (error) {
		console.error("Failed to get execution:", error);
		return NextResponse.json(
			{ error: "Failed to get execution" },
			{ status: 500 }
		);
	}
}
