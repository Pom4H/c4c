import { isSupportedHandlerFile, loadProceduresFromModule, type Registry, type RegistryModuleIndex } from "@c4c/core";
import { logProcedureChange } from "./formatting.js";

export async function reloadModuleProcedures(
	moduleIndex: RegistryModuleIndex,
	registry: Registry,
	filePath: string,
	handlersRoot: string
) {
	const previous = moduleIndex.get(filePath) ?? new Set<string>();
	try {
		const procedures = await loadProceduresFromModule(filePath, {
			versionHint: Date.now().toString(36),
		});
		const nextNames = new Set(procedures.keys());

		for (const name of previous) {
			if (!nextNames.has(name)) {
				const existing = registry.get(name);
				if (existing) {
					logProcedureChange("Removed", name, existing, filePath, handlersRoot);
				}
				registry.delete(name);
			}
		}

		for (const [name, procedure] of procedures) {
			const action = previous.has(name) ? "Updated" : "Registered";
			registry.set(name, procedure);
			logProcedureChange(action, name, procedure, filePath, handlersRoot);
		}

		moduleIndex.set(filePath, nextNames);
	} catch (error) {
		console.error(`[Registry] Failed to reload handler from ${filePath}:`, error);
	}
}

export async function removeModuleProcedures(
	moduleIndex: RegistryModuleIndex,
	registry: Registry,
	filePath: string,
	handlersRoot: string
) {
	const previous = moduleIndex.get(filePath);
	if (!previous) return;

	for (const name of previous) {
		const existing = registry.get(name);
		if (existing) {
			logProcedureChange("Removed", name, existing, filePath, handlersRoot);
		}
		registry.delete(name);
	}

	moduleIndex.delete(filePath);
}

export { isSupportedHandlerFile };
