/**
 * API Route: GET /api/workflow/definitions
 * Проксирует запрос на backend server
 */

import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function GET() {
	try {
		// Proxy request to backend server
		const response = await fetch(`${config.apiBase}/workflow/definitions`, {
			cache: "no-store",
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(data, { status: response.status });
		}

		// Transform data to match expected format
		const workflows = data.workflows || [];
		return NextResponse.json(workflows);
	} catch (error) {
		console.error("Failed to get workflow definitions:", error);
		return NextResponse.json(
			{ error: "Failed to get workflow definitions" },
			{ status: 500 }
		);
	}
}
