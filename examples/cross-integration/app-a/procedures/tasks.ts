/**
 * Task Management Procedures
 * 
 * CRUD operations for tasks with webhook triggers
 */

import type { Procedure } from '@c4c/core';
import { z } from 'zod';

// ==========================================
// SCHEMAS
// ==========================================

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type Task = z.infer<typeof TaskSchema>;

// In-memory storage (in production this would be a database)
const tasks = new Map<string, Task>();

// ==========================================
// CREATE TASK
// ==========================================

export const createTask: Procedure = {
  contract: {
    name: 'tasks.create',
    description: 'Create a new task',
    input: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      assignee: z.string().optional(),
      dueDate: z.string().optional(),
    }),
    output: TaskSchema,
    metadata: {
      exposure: 'external',
      roles: ['api-endpoint', 'workflow-node', 'sdk-client'],
      tags: ['tasks', 'create'],
    },
  },
  handler: async (input) => {
    const now = new Date().toISOString();
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task: Task = {
      id,
      title: input.title,
      description: input.description,
      status: input.status || 'todo',
      priority: input.priority,
      assignee: input.assignee,
      dueDate: input.dueDate,
      createdAt: now,
      updatedAt: now,
    };
    
    tasks.set(id, task);
    
    console.log(`[Tasks] Created task: ${task.title} (${task.id})`);
    
    return task;
  },
};

// ==========================================
// LIST TASKS
// ==========================================

export const listTasks: Procedure = {
  contract: {
    name: 'tasks.list',
    description: 'List all tasks with optional filters',
    input: z.object({
      status: z.enum(['todo', 'in_progress', 'done']).optional(),
      assignee: z.string().optional(),
      limit: z.number().optional(),
    }),
    output: z.object({
      tasks: z.array(TaskSchema),
      total: z.number(),
    }),
    metadata: {
      exposure: 'external',
      roles: ['api-endpoint', 'workflow-node', 'sdk-client'],
      tags: ['tasks', 'list'],
    },
  },
  handler: async (input) => {
    let filtered = Array.from(tasks.values());
    
    if (input.status) {
      filtered = filtered.filter(t => t.status === input.status);
    }
    
    if (input.assignee) {
      filtered = filtered.filter(t => t.assignee === input.assignee);
    }
    
    if (input.limit) {
      filtered = filtered.slice(0, input.limit);
    }
    
    console.log(`[Tasks] Listed ${filtered.length} tasks`);
    
    return {
      tasks: filtered,
      total: filtered.length,
    };
  },
};

// ==========================================
// GET TASK
// ==========================================

export const getTask: Procedure = {
  contract: {
    name: 'tasks.get',
    description: 'Get a task by ID',
    input: z.object({
      id: z.string(),
    }),
    output: TaskSchema,
    metadata: {
      exposure: 'external',
      roles: ['api-endpoint', 'workflow-node', 'sdk-client'],
      tags: ['tasks', 'get'],
    },
  },
  handler: async (input) => {
    const task = tasks.get(input.id);
    
    if (!task) {
      throw new Error(`Task not found: ${input.id}`);
    }
    
    console.log(`[Tasks] Retrieved task: ${task.title} (${task.id})`);
    
    return task;
  },
};

// ==========================================
// UPDATE TASK
// ==========================================

export const updateTask: Procedure = {
  contract: {
    name: 'tasks.update',
    description: 'Update a task',
    input: z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['todo', 'in_progress', 'done']).optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      assignee: z.string().optional(),
      dueDate: z.string().optional(),
    }),
    output: TaskSchema,
    metadata: {
      exposure: 'external',
      roles: ['api-endpoint', 'workflow-node', 'sdk-client'],
      tags: ['tasks', 'update'],
    },
  },
  handler: async (input) => {
    const task = tasks.get(input.id);
    
    if (!task) {
      throw new Error(`Task not found: ${input.id}`);
    }
    
    const updatedTask: Task = {
      ...task,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    
    tasks.set(input.id, updatedTask);
    
    console.log(`[Tasks] Updated task: ${updatedTask.title} (${updatedTask.id})`);
    
    return updatedTask;
  },
};

// ==========================================
// DELETE TASK
// ==========================================

export const deleteTask: Procedure = {
  contract: {
    name: 'tasks.delete',
    description: 'Delete a task',
    input: z.object({
      id: z.string(),
    }),
    output: z.object({
      success: z.boolean(),
      id: z.string(),
    }),
    metadata: {
      exposure: 'external',
      roles: ['api-endpoint', 'workflow-node', 'sdk-client'],
      tags: ['tasks', 'delete'],
    },
  },
  handler: async (input) => {
    const existed = tasks.delete(input.id);
    
    if (!existed) {
      throw new Error(`Task not found: ${input.id}`);
    }
    
    console.log(`[Tasks] Deleted task: ${input.id}`);
    
    return {
      success: true,
      id: input.id,
    };
  },
};

// ==========================================
// TRIGGERS (WEBHOOKS)
// ==========================================

/**
 * Webhook trigger: fires when a new task is created
 * External systems can subscribe to this event
 */
export const taskCreatedTrigger: Procedure = {
  contract: {
    name: 'tasks.trigger.created',
    description: 'Webhook fired when a new task is created',
    input: z.object({}),
    output: TaskSchema,
    metadata: {
      exposure: 'external',
      type: 'trigger',
      roles: ['webhook'],
      trigger: {
        kind: 'webhook',
        provider: 'tasks',
        event: 'created',
      },
      tags: ['tasks', 'webhook', 'trigger'],
    },
  },
  handler: async () => {
    throw new Error('This is a trigger procedure - it should not be called directly');
  },
};

/**
 * Webhook trigger: fires when a task is updated
 */
export const taskUpdatedTrigger: Procedure = {
  contract: {
    name: 'tasks.trigger.updated',
    description: 'Webhook fired when a task is updated',
    input: z.object({}),
    output: TaskSchema,
    metadata: {
      exposure: 'external',
      type: 'trigger',
      roles: ['webhook'],
      trigger: {
        kind: 'webhook',
        provider: 'tasks',
        event: 'updated',
      },
      tags: ['tasks', 'webhook', 'trigger'],
    },
  },
  handler: async () => {
    throw new Error('This is a trigger procedure - it should not be called directly');
  },
};
