import { isAbsolute, resolve } from "node:path";

/**
 * Resolve project root
 * No more hardcoded "procedures" or "workflows" paths!
 * We use introspection to discover everything.
 */
export function resolveProjectRoot(projectRoot?: string): string {
  if (!projectRoot || projectRoot === ".") {
    return process.cwd();
  }
  return isAbsolute(projectRoot) ? projectRoot : resolve(process.cwd(), projectRoot);
}

export function resolveOutputPath(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}
