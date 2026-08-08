import { z } from "zod";

export const traceSpanSchema = z.object({
  spanId: z.string(),
  traceId: z.string(),
  parentSpanId: z.string().optional(),
  name: z.string(),
  kind: z.string().default("INTERNAL"),
  startTime: z.number(),
  endTime: z.number(),
  duration: z.number(),
  status: z.object({
    code: z.enum(["OK", "ERROR", "UNSET"]),
    message: z.string().optional(),
  }),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  events: z
    .array(
      z.object({
        name: z.string(),
        timestamp: z.number(),
        attributes: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
});

export type TraceSpan = z.infer<typeof traceSpanSchema>;

export const schemaVariantSchema = z.object({
  value: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
  schema: z.unknown().optional(),
});

export const schemaDescriptorSchema = z.object({
  discriminator: z.string().optional(),
  description: z.string().optional(),
  variants: z.array(schemaVariantSchema).default([]),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  summary: z
    .object({
      input: z.string().optional(),
      output: z.string().optional(),
    })
    .optional(),
});

export type SchemaDescriptor = z.infer<typeof schemaDescriptorSchema>;

export const stepTransitionSchema = z.object({
  on: z.string(),
  to: z.string().optional().nullable(),
  guard: z.string().optional(),
  resume: z.boolean().optional(),
  label: z.string().optional(),
});

export type StepTransition = z.infer<typeof stepTransitionSchema>;

export const workflowStepSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string().optional(),
  hook: z.string(),
  schema: schemaDescriptorSchema.optional(),
  transitions: z.array(stepTransitionSchema).default([]),
  timeoutMs: z.number().optional(),
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;

export const workflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().default("1"),
  description: z.string().optional(),
  entryStep: z.string(),
  steps: z.array(workflowStepSchema),
  metadata: z.record(z.unknown()).optional(),
});

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

export const runErrorSchema = z.object({
  message: z.string(),
  name: z.string().optional(),
  retryable: z.boolean().optional(),
  details: z.unknown().optional(),
});

export type RunError = z.infer<typeof runErrorSchema>;

export const stepExecutionSchema = z.object({
  stepKey: z.string(),
  status: z
    .enum([
      "pending",
      "running",
      "waiting",
      "completed",
      "failed",
      "cancelled",
      "skipped",
    ])
    .default("pending"),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  durationMs: z.number().optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  checkpoint: z.unknown().optional(),
  error: runErrorSchema.optional(),
  events: z
    .array(
      z.object({
        type: z.string(),
        at: z.string(),
        payload: z.unknown().optional(),
      }),
    )
    .optional(),
});

export type StepExecution = z.infer<typeof stepExecutionSchema>;

export const workflowRunBaseSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workflowName: z.string().optional(),
  status: z
    .enum(["queued", "running", "waiting", "completed", "failed", "cancelled"])
    .default("running"),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  durationMs: z.number().optional(),
  output: z.unknown().optional(),
  error: runErrorSchema.optional(),
  spans: z.array(traceSpanSchema).optional(),
  steps: z.array(stepExecutionSchema).optional(),
  stepExecutions: z.array(stepExecutionSchema).optional(),
});

export type WorkflowRunBase = z.infer<typeof workflowRunBaseSchema>;

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName?: string;
  status: "queued" | "running" | "waiting" | "completed" | "failed" | "cancelled";
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  output?: unknown;
  error?: RunError;
  spans?: TraceSpan[];
  stepExecutions: StepExecution[];
}

export const workflowListResponseSchema = z.object({
  items: z.array(workflowDefinitionSchema).default([]),
  nextCursor: z.string().optional(),
});

export type WorkflowListResponse = z.infer<typeof workflowListResponseSchema>;

export const runListResponseSchema = z.object({
  items: z.array(workflowRunBaseSchema).default([]),
  nextCursor: z.string().optional(),
});

export type RunListResponse = z.infer<typeof runListResponseSchema>;

export interface WorkflowStats {
  total: number;
  running: number;
  waiting: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export type RunEvent =
  | {
      type: "run.started";
      runId: string;
      workflowId: string;
      startedAt: string;
    }
  | {
      type: "run.completed" | "run.failed" | "run.cancelled";
      runId: string;
      workflowId: string;
      finishedAt: string;
      durationMs?: number;
    }
  | {
      type: "step.started" | "step.waiting";
      runId: string;
      stepKey: string;
      timestamp: string;
    }
  | {
      type: "step.completed";
      runId: string;
      stepKey: string;
      timestamp: string;
      output?: unknown;
    }
  | {
      type: "step.failed";
      runId: string;
      stepKey: string;
      timestamp: string;
      error: RunError;
    };

