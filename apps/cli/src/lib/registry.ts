import { 
	isSupportedHandlerFile, 
	loadArtifactsFromModule,
	type Registry, 
	type WorkflowRegistry,
	type ProjectArtifacts,
} from "@c4c/core";
import { logProcedureChange, logWorkflowChange } from "./formatting.js";

/**
 * Module index now tracks both procedures and workflows
 */
export type ArtifactModuleIndex = Map<string, { procedures: Set<string>; workflows: Set<string> }>;

/**
 * Reload both procedures and workflows from a module
 * Single pass - handles both artifact types
 */
export async function reloadModuleArtifacts(
	moduleIndex: ArtifactModuleIndex,
	registry: Registry,
	workflowRegistry: WorkflowRegistry,
	filePath: string,
	projectRoot: string
) {
	const previous = moduleIndex.get(filePath) ?? { procedures: new Set<string>(), workflows: new Set<string>() };
	
	try {
		const artifacts = await loadArtifactsFromModule(filePath, {
			versionHint: Date.now().toString(36),
		});
		
		const nextProcedures = new Set(artifacts.procedures.keys());
		const nextWorkflows = new Set(artifacts.workflows.keys());

		// Handle removed procedures
		for (const name of previous.procedures) {
			if (!nextProcedures.has(name)) {
				const existing = registry.get(name);
				if (existing) {
					logProcedureChange("Removed", name, existing, filePath, projectRoot);
				}
				registry.delete(name);
			}
		}

		// Handle removed workflows
		for (const id of previous.workflows) {
			if (!nextWorkflows.has(id)) {
				const existing = workflowRegistry.get(id);
				if (existing) {
					logWorkflowChange("Removed", id, existing, filePath, projectRoot);
				}
				workflowRegistry.delete(id);
			}
		}

		// Handle new/updated procedures
		for (const [name, procedure] of artifacts.procedures) {
			const action = previous.procedures.has(name) ? "Updated" : "Registered";
			registry.set(name, procedure);
			logProcedureChange(action, name, procedure, filePath, projectRoot);
		}

		// Handle new/updated workflows
		for (const [id, workflow] of artifacts.workflows) {
			const action = previous.workflows.has(id) ? "Updated" : "Registered";
			workflowRegistry.set(id, workflow);
			logWorkflowChange(action, id, workflow, filePath, projectRoot);
		}

		moduleIndex.set(filePath, { procedures: nextProcedures, workflows: nextWorkflows });
	} catch (error) {
		console.error(`[Registry] Failed to reload artifacts from ${filePath}:`, error);
	}
}

/**
 * Remove all artifacts from a module
 */
export async function removeModuleArtifacts(
	moduleIndex: ArtifactModuleIndex,
	registry: Registry,
	workflowRegistry: WorkflowRegistry,
	filePath: string,
	projectRoot: string
) {
	const previous = moduleIndex.get(filePath);
	if (!previous) return;

	// Remove procedures
	for (const name of previous.procedures) {
		const existing = registry.get(name);
		if (existing) {
			logProcedureChange("Removed", name, existing, filePath, projectRoot);
		}
		registry.delete(name);
	}

	// Remove workflows
	for (const id of previous.workflows) {
		const existing = workflowRegistry.get(id);
		if (existing) {
			logWorkflowChange("Removed", id, existing, filePath, projectRoot);
		}
		workflowRegistry.delete(id);
	}

	moduleIndex.delete(filePath);
}

export { isSupportedHandlerFile };
