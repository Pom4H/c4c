/**
 * API endpoint for cancelling paused workflows
 * POST /api/workflow/cancel - Cancel a paused execution
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId, reason } = body;

    if (!executionId) {
      return NextResponse.json(
        { error: "executionId is required" },
        { status: 400 }
      );
    }

    // In production, this would:
    // 1. Remove from pausedExecutions in TriggerWorkflowManager
    // 2. Mark execution as cancelled in ExecutionStore
    // 3. Clean up any scheduled timeouts
    
    // Example:
    // triggerManager.cancelPausedExecution(executionId, reason);

    console.log(`[API] Cancel workflow: ${executionId}`, reason);

    // Mock success response
    return NextResponse.json({
      success: true,
      executionId,
      status: "cancelled",
      message: "Workflow cancelled successfully",
    });
  } catch (error) {
    console.error("[API] Failed to cancel workflow:", error);
    return NextResponse.json(
      {
        error: "Failed to cancel workflow",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
