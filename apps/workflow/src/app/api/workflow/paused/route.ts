/**
 * API endpoint for paused workflows
 * GET /api/workflow/paused - List all paused executions
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // In production, this would query TriggerWorkflowManager.getPausedExecutions()
    // For now, return mock data or connect to your workflow engine
    
    // Example: If you have a global workflow manager instance:
    // const pausedExecutions = triggerManager.getPausedExecutions();
    
    // Mock data for development
    const pausedWorkflows = [
      {
        executionId: "wf_exec_123_abc",
        workflowId: "process-order",
        workflowName: "Order Processing",
        pausedAt: "wait-approval",
        pausedTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        waitingFor: ["orders.trigger.approved"],
        timeoutAt: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(), // 22 hours from now
        variables: {
          orderId: "order_12345",
          customerEmail: "john@example.com",
          riskScore: 85,
        },
      },
      {
        executionId: "wf_exec_456_def",
        workflowId: "process-order",
        workflowName: "Order Processing",
        pausedAt: "wait-payment",
        pausedTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
        waitingFor: ["payment-service.payments.trigger.completed"],
        timeoutAt: new Date(Date.now() + 71.5 * 60 * 60 * 1000).toISOString(),
        variables: {
          orderId: "order_12346",
          customerEmail: "jane@example.com",
        },
      },
    ];

    return NextResponse.json({
      pausedWorkflows,
      count: pausedWorkflows.length,
    });
  } catch (error) {
    console.error("[API] Failed to fetch paused workflows:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch paused workflows",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
