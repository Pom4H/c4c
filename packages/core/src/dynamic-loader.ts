/**
 * Dynamic module loader for tsdev
 * Allows loading and hot-reloading of generated contracts and handlers
 */

import { Registry, Procedure } from "./index.js";
import { readFile, writeFile, mkdir, stat } from "fs/promises";
import { join, dirname } from "path";
import { createHash } from "crypto";

export interface DynamicModule {
  id: string;
  name: string;
  version: string;
  source: "openapi" | "manual";
  files: {
    contracts: string;
    handlers: string;
    types?: string;
    zodSchemas?: string;
    webhooks?: string;
    oauthCallbacks?: string;
    index: string;
    packageJson: string;
  };
  procedures: Map<string, Procedure>;
  createdAt: Date;
  updatedAt: Date;
  gitBranch?: string;
  gitCommit?: string;
}

export interface DynamicLoaderOptions {
  modulesDir: string;
  gitEnabled: boolean;
  gitRemote?: string;
  autoCommit: boolean;
  commitMessage?: string;
}

export class DynamicLoader {
  private modules: Map<string, DynamicModule> = new Map();
  private registry: Registry;
  private options: DynamicLoaderOptions;
  private gitAvailable: boolean = false;

  constructor(registry: Registry, options: DynamicLoaderOptions) {
    this.registry = registry;
    this.options = {
      modulesDir: "./generated-modules",
      gitEnabled: true,
      autoCommit: true,
      commitMessage: "feat: add generated OpenAPI procedures",
      ...options,
    };
    this.checkGitAvailability();
  }

  /**
   * Check if git is available and configured
   */
  private async checkGitAvailability(): Promise<void> {
    try {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);
      
      await execAsync("git --version");
      this.gitAvailable = true;
    } catch {
      this.gitAvailable = false;
      console.warn("Git is not available. Dynamic loading will work without git integration.");
    }
  }

  /**
   * Load a generated module dynamically
   */
  async loadModule(
    moduleId: string,
    files: DynamicModule["files"],
    metadata: {
      name: string;
      source: "openapi" | "manual";
      gitBranch?: string;
    }
  ): Promise<DynamicModule> {
    const moduleDir = join(this.options.modulesDir, moduleId);
    await mkdir(moduleDir, { recursive: true });

    // Save files to disk
    await this.saveModuleFiles(moduleDir, files);

    // Create git branch if enabled
    let gitBranch: string | undefined;
    let gitCommit: string | undefined;

    if (this.options.gitEnabled && this.gitAvailable) {
      gitBranch = await this.createGitBranch(moduleId, metadata.name);
      if (this.options.autoCommit) {
        gitCommit = await this.commitModule(moduleId, metadata.name);
      }
    }

    // Load procedures from the generated module
    const procedures = await this.loadProceduresFromModule(moduleDir);

    // Add procedures to registry
    for (const [name, procedure] of procedures) {
      this.registry.set(name, procedure);
    }

    const module: DynamicModule = {
      id: moduleId,
      name: metadata.name,
      version: "1.0.0",
      source: metadata.source,
      files,
      procedures,
      createdAt: new Date(),
      updatedAt: new Date(),
      gitBranch,
      gitCommit,
    };

    this.modules.set(moduleId, module);
    return module;
  }

  /**
   * Save module files to disk
   */
  private async saveModuleFiles(moduleDir: string, files: DynamicModule["files"]): Promise<void> {
    const filePromises = [
      writeFile(join(moduleDir, "contracts.ts"), files.contracts),
      writeFile(join(moduleDir, "handlers.ts"), files.handlers),
      writeFile(join(moduleDir, "index.ts"), files.index),
      writeFile(join(moduleDir, "package.json"), files.packageJson),
    ];

    if (files.types) {
      filePromises.push(writeFile(join(moduleDir, "types.ts"), files.types));
    }
    if (files.zodSchemas) {
      filePromises.push(writeFile(join(moduleDir, "schemas.ts"), files.zodSchemas));
    }
    if (files.webhooks) {
      filePromises.push(writeFile(join(moduleDir, "webhooks.ts"), files.webhooks));
    }
    if (files.oauthCallbacks) {
      filePromises.push(writeFile(join(moduleDir, "oauth-callbacks.ts"), files.oauthCallbacks));
    }

    await Promise.all(filePromises);
  }

  /**
   * Create git branch for the module
   */
  private async createGitBranch(moduleId: string, moduleName: string): Promise<string> {
    const branchName = `feature/generated-${moduleName}-${moduleId.slice(0, 8)}`;
    
    try {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);

      // Create and checkout new branch
      await execAsync(`git checkout -b ${branchName}`);
      
      return branchName;
    } catch (error) {
      console.warn(`Failed to create git branch: ${error}`);
      return branchName;
    }
  }

  /**
   * Commit the module to git
   */
  private async commitModule(moduleId: string, moduleName: string): Promise<string> {
    try {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);

      // Add all files
      await execAsync("git add .");
      
      // Commit with message
      const commitMessage = this.options.commitMessage?.replace("{moduleName}", moduleName) || 
        `feat: add generated procedures for ${moduleName}`;
      
      await execAsync(`git commit -m "${commitMessage}"`);
      
      // Get commit hash
      const { stdout } = await execAsync("git rev-parse HEAD");
      return stdout.trim();
    } catch (error) {
      console.warn(`Failed to commit module: ${error}`);
      return "";
    }
  }

  /**
   * Load procedures from a module directory
   */
  private async loadProceduresFromModule(moduleDir: string): Promise<Map<string, Procedure>> {
    const procedures = new Map<string, Procedure>();
    
    try {
      // Read the index file to get procedure exports
      const indexContent = await readFile(join(moduleDir, "index.ts"), "utf-8");
      
      // Extract procedure names from the index file
      const procedureMatches = indexContent.match(/export const (\w+)Procedure:/g);
      if (!procedureMatches) {
        return procedures;
      }

      // For now, we'll create placeholder procedures
      // In a real implementation, you would dynamically import the module
      for (const match of procedureMatches) {
        const procedureName = match.match(/export const (\w+)Procedure:/)?.[1];
        if (procedureName) {
          // Create a placeholder procedure
          // In production, you would load the actual procedure from the generated module
          const procedure: Procedure = {
            contract: {
              name: procedureName,
              description: `Generated procedure: ${procedureName}`,
              input: { parse: () => ({}) } as any,
              output: { parse: () => ({}) } as any,
              metadata: {
                source: "generated",
                moduleId: moduleDir.split("/").pop() || "",
              },
            },
            handler: async () => {
              throw new Error(`Procedure ${procedureName} not yet implemented`);
            },
          };
          
          procedures.set(procedureName, procedure);
        }
      }
    } catch (error) {
      console.error(`Failed to load procedures from module ${moduleDir}:`, error);
    }

    return procedures;
  }

  /**
   * Reload a module (hot reload)
   */
  async reloadModule(moduleId: string): Promise<DynamicModule | null> {
    const module = this.modules.get(moduleId);
    if (!module) {
      return null;
    }

    // Remove old procedures from registry
    for (const [name] of module.procedures) {
      this.registry.delete(name);
    }

    // Reload procedures
    const moduleDir = join(this.options.modulesDir, moduleId);
    const procedures = await this.loadProceduresFromModule(moduleDir);

    // Add new procedures to registry
    for (const [name, procedure] of procedures) {
      this.registry.set(name, procedure);
    }

    // Update module
    module.procedures = procedures;
    module.updatedAt = new Date();

    return module;
  }

  /**
   * Unload a module
   */
  async unloadModule(moduleId: string): Promise<boolean> {
    const module = this.modules.get(moduleId);
    if (!module) {
      return false;
    }

    // Remove procedures from registry
    for (const [name] of module.procedures) {
      this.registry.delete(name);
    }

    // Remove from modules map
    this.modules.delete(moduleId);

    return true;
  }

  /**
   * Get all loaded modules
   */
  getModules(): DynamicModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get a specific module
   */
  getModule(moduleId: string): DynamicModule | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * Get module statistics
   */
  getStats(): {
    totalModules: number;
    totalProcedures: number;
    modulesBySource: Record<string, number>;
    gitEnabled: boolean;
  } {
    const modules = Array.from(this.modules.values());
    const modulesBySource = modules.reduce((acc, module) => {
      acc[module.source] = (acc[module.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalModules: modules.length,
      totalProcedures: modules.reduce((sum, module) => sum + module.procedures.size, 0),
      modulesBySource,
      gitEnabled: this.gitAvailable,
    };
  }
}