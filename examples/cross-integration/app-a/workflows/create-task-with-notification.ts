/**
 * Cross-App Workflow: Create Task and Send Notification
 * 
 * This workflow demonstrates cross-app integration:
 * 1. Creates a task in App A (local procedure)
 * 2. Calls App B to send a notification (cross-app procedure)
 */

import type { WorkflowDefinition } from "@c4c/workflow";

export const createTaskWithNotification: WorkflowDefinition = {
  id: "create-task-with-notification",
  name: "Create Task with Notification",
  description: "Creates a task and sends notification via cross-app call to notification service",
  version: "1.0.0",

  startNode: "create-task",

  nodes: [
    {
      id: "create-task",
      type: "procedure",
      procedureName: "tasks.create",
      config: {
        title: "Cross-App Integration Test",
        description: "This task was created by a workflow that calls another service",
        priority: "high",
        status: "todo",
      },
      next: "send-notification",
    },
    {
      id: "send-notification",
      type: "procedure",
      // 🔥 Cross-app call: calling procedure from App B (notification-service)
      procedureName: "notification-service.notifications.send",
      config: {
        message: "✅ New task created via cross-app workflow!",
        channel: "push",
        priority: "high",
      },
    },
  ],
};
