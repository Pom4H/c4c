import { z } from "zod";
import { config } from "@/lib/config";
import {
  RunEvent,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunBase,
  WorkflowStats,
  runListResponseSchema,
  schemaDescriptorSchema,
  schemaVariantSchema,
  stepExecutionSchema,
  traceSpanSchema,
  workflowDefinitionSchema,
  workflowListResponseSchema,
  workflowRunBaseSchema,
} from "./types";

type FetcherInit = RequestInit & { skipNormalization?: boolean };

const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

async function fetchJson<T = unknown>(path: string, init?: FetcherInit): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : `${config.useWorkflowApiBase}${path.startsWith("/") ? "" : "/"}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }

    const message =
      typeof errorBody === "object" && errorBody && "message" in errorBody
        ? String((errorBody as { message: unknown }).message)
        : `Request to ${url} failed with status ${response.status}`;

    throw new Error(message, { cause: errorBody });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();
  return data as T;
}

function normalizeWorkflow(data: unknown): WorkflowDefinition {
  // use zod parsing with lax fallback for variant arrays that may be plain records
  const parsed = workflowDefinitionSchema.parse(
    convertStepSchemaVariants(data),
  );
  return parsed;
}

function convertStepSchemaVariants(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map(convertStepSchemaVariants);
  }

  const record = value as Record<string, unknown>;
  const entries = Object.entries(record).map(([key, val]) => {
    if (key === "schema" && val && typeof val === "object" && !Array.isArray(val)) {
      const schemaRecord = val as Record<string, unknown>;
      if (schemaRecord.variants && Array.isArray(schemaRecord.variants)) {
        schemaRecord.variants = schemaRecord.variants.map((variant) => {
          if (typeof variant === "string") {
            return { value: variant } satisfies z.infer<typeof schemaVariantSchema>;
          }
          if (variant && typeof variant === "object") {
            return variant;
          }
          return { value: String(variant) };
        });
      }
      return [key, schemaDescriptorSchema.parse(schemaRecord)];
    }

    return [key, convertStepSchemaVariants(val)];
  });

  return Object.fromEntries(entries);
}

function normalizeRun(base: WorkflowRunBase): WorkflowRun {
  const stepExecutions = base.stepExecutions ?? base.steps ?? [];

  const spans = base.spans?.map((span) => traceSpanSchema.parse(span));

  return {
    id: base.id,
    workflowId: base.workflowId,
    workflowName: base.workflowName,
    status: base.status,
    startedAt: base.startedAt,
    finishedAt: base.finishedAt,
    durationMs: base.durationMs,
    output: base.output,
    error: base.error,
    spans,
    stepExecutions: stepExecutions.map((step) => stepExecutionSchema.parse(step)),
  };
}

function deriveStats(runs: WorkflowRun[]): WorkflowStats {
  return runs.reduce<WorkflowStats>(
    (acc, run) => {
      acc.total += 1;
      acc[run.status as keyof WorkflowStats] =
        (acc[run.status as keyof WorkflowStats] ?? 0) + 1;
      if (run.status === "running" || run.status === "waiting" || run.status === "queued") {
        acc.running += 1;
      }
      if (run.status === "waiting") {
        acc.waiting += 1;
      }
      return acc;
    },
    {
      total: 0,
      running: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    },
  );
}

type ListResponse<T> = { items: T[] } | T[];

function unwrapList<T>(value: ListResponse<T>): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === "object" && Array.isArray(value.items)) {
    return value.items;
  }
  return [];
}

export async function listWorkflows(): Promise<WorkflowDefinition[]> {
  const raw = await fetchJson<unknown>("/workflows");

  const parsedList = (() => {
    try {
      // First attempt to parse as envelope { items: [] }
      return workflowListResponseSchema.parse(convertStepSchemaVariants(raw)).items;
    } catch {
      // Fallback to array of definitions
      const items = unwrapList<unknown>(raw as ListResponse<unknown>);
      return items.map((item) => normalizeWorkflow(item));
    }
  })();

  return parsedList.map((wf) => normalizeWorkflow(wf));
}

export async function getWorkflow(workflowId: string): Promise<WorkflowDefinition> {
  const raw = await fetchJson<unknown>(`/workflows/${workflowId}`);
  return normalizeWorkflow(raw);
}

export async function listRuns(): Promise<{ runs: WorkflowRun[]; stats: WorkflowStats }> {
  const raw = await fetchJson<unknown>("/runs?limit=50");

  let bases: WorkflowRunBase[];
  try {
    const parsed = runListResponseSchema.parse(raw);
    bases = parsed.items;
  } catch {
    const items = unwrapList<unknown>(raw as ListResponse<unknown>);
    bases = items.map((item) => workflowRunBaseSchema.parse(item));
  }

  const runs = bases.map(normalizeRun);
  const stats = deriveStats(runs);
  return { runs, stats };
}

export async function getRun(runId: string): Promise<WorkflowRun> {
  const raw = await fetchJson<unknown>(`/runs/${runId}`);
  const base = workflowRunBaseSchema.parse(raw);
  return normalizeRun(base);
}

const startRunPayloadSchema = z.object({
  workflowId: z.string(),
  input: z.record(z.unknown()).optional().default({}),
  options: z
    .object({
      runId: z.string().optional(),
      tags: z.array(z.string()).optional(),
      metadata: z.record(z.unknown()).optional(),
      resumeToken: z.string().optional(),
    })
    .optional(),
});

export type StartRunPayload = z.infer<typeof startRunPayloadSchema>;

export async function startRun(payload: StartRunPayload): Promise<WorkflowRun> {
  const parsed = startRunPayloadSchema.parse(payload);

  const body = {
    input: parsed.input,
    options: parsed.options ?? {},
  };

  const raw = await fetchJson<unknown>(`/workflows/${parsed.workflowId}/runs`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const base = workflowRunBaseSchema.parse(raw);
  return normalizeRun(base);
}

export function getRunsStreamUrl(): string {
  return `${config.useWorkflowStreamBase}/stream`;
}

export function getRunStreamUrl(runId: string): string {
  return `${config.useWorkflowStreamBase}/${runId}/stream`;
}

export function parseRunEvent(data: string): RunEvent | null {
  try {
    const parsed = JSON.parse(data) as RunEvent;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (!("type" in parsed)) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn("[useworkflow] Failed to parse run event", error);
    return null;
  }
}

