import { isAbsolute, join, resolve } from "node:path";

export function resolveProjectRoot(projectRoot?: string): string {
  if (!projectRoot || projectRoot === ".") {
    return process.cwd();
  }
  return isAbsolute(projectRoot) ? projectRoot : resolve(process.cwd(), projectRoot);
}

// Handlers must live strictly under <root>/handlers
export function determineHandlersPath(root: string): string {
  return join(root, "handlers");
}

// Workflows must live strictly under <root>/workflows
export function determineWorkflowsPath(root: string): string {
  return join(root, "workflows");
}

export function resolveOutputPath(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}
