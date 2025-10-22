/**
 * API Route: GET /api/workflow/executions
 * Проксирует запрос на backend server
 */

import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		// Proxy request to backend server
		const response = await fetch(`${config.apiBase}/workflow/executions`, {
			cache: "no-store",
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(data, { status: response.status });
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Failed to get executions:", error);
		return NextResponse.json(
			{ error: "Failed to get executions" },
			{ status: 500 }
		);
	}
}
