/**
 * Task Management Procedures
 * 
 * CRUD operations for tasks with webhook triggers
 */

import { defineContract, defineProcedure } from '@c4c/core';
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

// In-memory storage (в production это была бы БД)
const tasks = new Map<string, Task>();

// ==========================================
// CREATE TASK
// ==========================================

export const createTaskContract = defineContract({
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
});

export const createTask = defineProcedure({
  contract: createTaskContract,
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
});

// ==========================================
// LIST TASKS
// ==========================================

export const listTasksContract = defineContract({
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
});

export const listTasks = defineProcedure({
  contract: listTasksContract,
  handler: async (input) => {
    let filteredTasks = Array.from(tasks.values());
    
    // Apply filters
    if (input.status) {
      filteredTasks = filteredTasks.filter(t => t.status === input.status);
    }
    
    if (input.assignee) {
      filteredTasks = filteredTasks.filter(t => t.assignee === input.assignee);
    }
    
    // Apply limit
    if (input.limit) {
      filteredTasks = filteredTasks.slice(0, input.limit);
    }
    
    return {
      tasks: filteredTasks,
      total: filteredTasks.length,
    };
  },
});

// ==========================================
// GET TASK
// ==========================================

export const getTaskContract = defineContract({
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
});

export const getTask = defineProcedure({
  contract: getTaskContract,
  handler: async (input) => {
    const task = tasks.get(input.id);
    
    if (!task) {
      throw new Error(`Task not found: ${input.id}`);
    }
    
    return task;
  },
});

// ==========================================
// UPDATE TASK
// ==========================================

export const updateTaskContract = defineContract({
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
});

export const updateTask = defineProcedure({
  contract: updateTaskContract,
  handler: async (input) => {
    const task = tasks.get(input.id);
    
    if (!task) {
      throw new Error(`Task not found: ${input.id}`);
    }
    
    const updated: Task = {
      ...task,
      ...(input.title && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status && { status: input.status }),
      ...(input.priority && { priority: input.priority }),
      ...(input.assignee !== undefined && { assignee: input.assignee }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      updatedAt: new Date().toISOString(),
    };
    
    tasks.set(input.id, updated);
    
    console.log(`[Tasks] Updated task: ${updated.title} (${updated.id})`);
    
    return updated;
  },
});

// ==========================================
// DELETE TASK
// ==========================================

export const deleteTaskContract = defineContract({
  name: 'tasks.delete',
  description: 'Delete a task',
  input: z.object({
    id: z.string(),
  }),
  output: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  metadata: {
    exposure: 'external',
    roles: ['api-endpoint', 'workflow-node', 'sdk-client'],
    tags: ['tasks', 'delete'],
  },
});

export const deleteTask = defineProcedure({
  contract: deleteTaskContract,
  handler: async (input) => {
    const task = tasks.get(input.id);
    
    if (!task) {
      throw new Error(`Task not found: ${input.id}`);
    }
    
    tasks.delete(input.id);
    
    console.log(`[Tasks] Deleted task: ${task.title} (${task.id})`);
    
    return {
      success: true,
      message: `Task ${input.id} deleted`,
    };
  },
});

// ==========================================
// WEBHOOKS / TRIGGERS
// ==========================================

/**
 * Task Created Trigger
 * Webhook that fires when a new task is created
 */
export const taskCreatedTriggerContract = defineContract({
  name: 'tasks.trigger.created',
  description: 'Webhook trigger that fires when a task is created',
  input: z.object({
    webhookUrl: z.string().url(),
  }),
  output: TaskSchema, // What the webhook will send
  metadata: {
    exposure: 'external',
    type: 'trigger',
    roles: ['trigger', 'workflow-node'],
    tags: ['tasks', 'webhook', 'trigger'],
    trigger: {
      type: 'webhook',
      eventTypes: ['task.created'],
      requiresChannelManagement: false,
    },
    provider: 'task-manager',
  },
});

export const taskCreatedTrigger = defineProcedure({
  contract: taskCreatedTriggerContract,
  handler: async (input) => {
    // В реальном приложении здесь бы регистрировался webhook URL
    console.log(`[Tasks] Registered webhook for task.created: ${input.webhookUrl}`);
    
    // Возвращаем пустую задачу (это просто для типизации)
    return {
      id: '',
      title: '',
      status: 'todo' as const,
      createdAt: '',
      updatedAt: '',
    };
  },
});

/**
 * Task Updated Trigger
 * Webhook that fires when a task is updated
 */
export const taskUpdatedTriggerContract = defineContract({
  name: 'tasks.trigger.updated',
  description: 'Webhook trigger that fires when a task is updated',
  input: z.object({
    webhookUrl: z.string().url(),
  }),
  output: z.object({
    task: TaskSchema,
    previousTask: TaskSchema.optional(),
    changes: z.array(z.string()),
  }),
  metadata: {
    exposure: 'external',
    type: 'trigger',
    roles: ['trigger', 'workflow-node'],
    tags: ['tasks', 'webhook', 'trigger'],
    trigger: {
      type: 'webhook',
      eventTypes: ['task.updated'],
      requiresChannelManagement: false,
    },
    provider: 'task-manager',
  },
});

export const taskUpdatedTrigger = defineProcedure({
  contract: taskUpdatedTriggerContract,
  handler: async (input) => {
    console.log(`[Tasks] Registered webhook for task.updated: ${input.webhookUrl}`);
    
    return {
      task: {
        id: '',
        title: '',
        status: 'todo' as const,
        createdAt: '',
        updatedAt: '',
      },
      changes: [],
    };
  },
});

// ==========================================
// EXPORTS
// ==========================================

export const TaskProcedures = [
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
  taskCreatedTrigger,
  taskUpdatedTrigger,
];
