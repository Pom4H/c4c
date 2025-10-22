/**
 * API Route: POST /api/workflow/execute
 * Проксирует запрос на backend server
 */

import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function POST(request: Request) {
	try {
		const body = await request.json();

		// Proxy request to backend server
		const response = await fetch(`${config.apiBase}/workflow/execute`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(data, { status: response.status });
		}

		return NextResponse.json(data);
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
