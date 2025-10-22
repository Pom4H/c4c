/**
 * API Route: GET /api/workflow/executions/[id]
 * Проксирует запрос на backend server
 */

import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;

		// Proxy request to backend server
		const response = await fetch(`${config.apiBase}/workflow/executions/${id}`, {
			cache: "no-store",
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(data, { status: response.status });
		}

		// Backend returns { execution }, we want to return just the execution
		return NextResponse.json(data.execution || data);
	} catch (error) {
		console.error("Failed to get execution:", error);
		return NextResponse.json(
			{ error: "Failed to get execution" },
			{ status: 500 }
		);
	}
}
