/**
 * API Route: GET /api/workflow/definitions/[id]
 * Proxies request to backend server
 */

import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;

		// Proxy request to backend server
		const response = await fetch(`${config.apiBase}/workflow/definitions/${id}`, {
			cache: "no-store",
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(data, { status: response.status });
		}

		// Backend returns { definition }, we want to return just the definition
		return NextResponse.json(data.definition || data);
	} catch (error) {
		console.error("Failed to get workflow definition:", error);
		return NextResponse.json(
			{ error: "Failed to get workflow definition" },
			{ status: 500 }
		);
	}
}
