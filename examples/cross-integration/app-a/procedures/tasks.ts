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
    const data = input as any;
    const now = new Date().toISOString();
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task: Task = {
      id,
      title: data.title,
      description: data.description,
      status: data.status || 'todo',
      priority: data.priority,
      assignee: data.assignee,
      dueDate: data.dueDate,
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
    const data = input as any;
    let filtered = Array.from(tasks.values());
    
    if (data.status) {
      filtered = filtered.filter(t => t.status === data.status);
    }
    
    if (data.assignee) {
      filtered = filtered.filter(t => t.assignee === data.assignee);
    }
    
    if (data.limit) {
      filtered = filtered.slice(0, data.limit);
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
    const data = input as any;
    const task = tasks.get(data.id);
    
    if (!task) {
      throw new Error(`Task not found: ${data.id}`);
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
    const data = input as any;
    const task = tasks.get(data.id);
    
    if (!task) {
      throw new Error(`Task not found: ${data.id}`);
    }
    
    const updatedTask: Task = {
      ...task,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    
    tasks.set(data.id, updatedTask);
    
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
    const data = input as any;
    const existed = tasks.delete(data.id);
    
    if (!existed) {
      throw new Error(`Task not found: ${data.id}`);
    }
    
    console.log(`[Tasks] Deleted task: ${data.id}`);
    
    return {
      success: true,
      id: data.id,
    };
  },
};

// ==========================================
// TRIGGERS (WEBHOOKS)
// ==========================================

/**
 * Trigger procedure for task.created event
 * 
 * Works for BOTH:
 * - Internal (monolith): emitTriggerEvent('tasks.trigger.created', data)
 * - External (microservices): POST /webhooks/tasks → tasks.trigger.created
 * 
 * When moving to microservices, only 'exposure' changes from 'internal' to 'external'
 * Workflows using this trigger remain IDENTICAL!
 */

import { createTriggerProcedure } from '@c4c/workflow';

export const taskCreatedTrigger = createTriggerProcedure(
  'tasks.trigger.created',
  TaskSchema,
  {
    description: 'Triggered when a new task is created',
    provider: 'tasks',
    eventTypes: ['created'],
    exposure: 'internal', // Change to 'external' for microservices!
  }
);

export const taskUpdatedTrigger = createTriggerProcedure(
  'tasks.trigger.updated',
  TaskSchema,
  {
    description: 'Triggered when a task is updated',
    provider: 'tasks',
    eventTypes: ['updated'],
    exposure: 'internal', // Change to 'external' for microservices!
  }
);
