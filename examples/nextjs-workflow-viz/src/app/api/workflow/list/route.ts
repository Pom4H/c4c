/**
 * API Route: List Workflows
 * 
 * Returns all available workflow definitions
 */

import { NextResponse } from "next/server";
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

export async function GET() {
	try {
		const workflowList = Object.values(workflows).map((wf) => ({
			id: wf.id,
			name: wf.name,
			description: wf.description,
			version: wf.version,
			nodeCount: wf.nodes.length,
			metadata: wf.metadata,
		}));

		return NextResponse.json({ workflows: workflowList });
	} catch (error) {
		console.error("[API] Error listing workflows:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
