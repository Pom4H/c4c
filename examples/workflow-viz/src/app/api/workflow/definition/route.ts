/**
 * API Route: Get Workflow Definition
 * 
 * Returns a specific workflow definition by ID
 */

import { NextRequest, NextResponse } from "next/server";
import {
	mathWorkflow,
	conditionalWorkflow,
	parallelWorkflow,
	complexWorkflow,
} from "@/lib/workflow/examples";

const workflows = {
	"math-calculation": mathWorkflow,
	"conditional-processing": conditionalWorkflow,
	"parallel-tasks": parallelWorkflow,
	"complex-workflow": complexWorkflow,
};

export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const workflowId = searchParams.get("id");

		if (!workflowId) {
			return NextResponse.json(
				{ error: "workflowId parameter is required" },
				{ status: 400 }
			);
		}

		const workflow = workflows[workflowId as keyof typeof workflows];

		if (!workflow) {
			return NextResponse.json(
				{ error: `Workflow ${workflowId} not found` },
				{ status: 404 }
			);
		}

		return NextResponse.json({ definition: workflow });
	} catch (error) {
		console.error("[API] Error getting workflow definition:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
