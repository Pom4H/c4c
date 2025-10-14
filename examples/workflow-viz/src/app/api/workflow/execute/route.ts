/**
 * API Route: Execute Workflow
 * 
 * This endpoint executes workflows using the core framework runtime with OTEL tracing
 */

import { NextRequest, NextResponse } from "next/server";
import { executeWorkflow } from "@/lib/workflow/runtime";
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

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { workflowId, input = {} } = body;

		if (!workflowId) {
			return NextResponse.json(
				{ error: "workflowId is required" },
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

		console.log(`[API] Executing workflow: ${workflow.name}`);

		const result = await executeWorkflow(workflow, input);

		console.log(
			`[API] Workflow completed: ${result.status} (${result.executionTime}ms)`
		);

		return NextResponse.json(result);
	} catch (error) {
		console.error("[API] Workflow execution error:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Unknown error",
				details: error instanceof Error ? error.stack : undefined,
			},
			{ status: 500 }
		);
	}
}
