import { globSync } from 'glob';
import type { WorkflowDefinition } from './types.js';

export async function collectWorkflows(basePath = 'workflows'): Promise<Map<string, WorkflowDefinition>> {
  const map = new Map<string, WorkflowDefinition>();
  const files = globSync(`${basePath}/**/*.{ts,js}`, { absolute: true, ignore: ['**/*.test.*', '**/*.spec.*'] });
  for (const file of files) {
    try {
      const mod = await import(file);
      for (const [key, value] of Object.entries(mod)) {
        if (isWorkflowDefinition(value)) {
          const wf = value as WorkflowDefinition;
          map.set(wf.id, wf);
        }
      }
    } catch (err) {
      console.error(`[Workflows] Failed to load ${file}`, err);
    }
  }
  return map;
}

export function listWorkflows(map: Map<string, WorkflowDefinition>): Array<{ id: string; name: string; version: string; description?: string }> {
  return Array.from(map.values()).map((wf) => ({ id: wf.id, name: wf.name, version: wf.version, description: wf.description }));
}

export function getWorkflowById(map: Map<string, WorkflowDefinition>, id: string): WorkflowDefinition | undefined {
  return map.get(id);
}

function isWorkflowDefinition(value: unknown): value is WorkflowDefinition {
  return (
    typeof value === 'object' && value !== null &&
    'id' in value && 'name' in value && 'version' in value && 'nodes' in value && 'startNode' in value
  );
}
