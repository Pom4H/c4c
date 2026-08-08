/**
 * Workflow Validator
 * 
 * Validates workflow definitions for correctness
 */

import type { Registry } from "@c4c/core";
import type { WorkflowDefinition } from "../types/index.js";

/**
 * Validate workflow definition
 */
export function validateWorkflow(workflow: WorkflowDefinition, registry: Registry): string[] {
	const errors: string[] = [];

	// Check start node exists
	if (!workflow.nodes.find((n) => n.id === workflow.startNode)) {
		errors.push(`Start node ${workflow.startNode} not found`);
	}

	// Validate each node
	for (const node of workflow.nodes) {
		// Check procedure exists in registry
		if (node.type === "procedure" && node.procedureName) {
			if (!registry.has(node.procedureName)) {
				errors.push(`Node ${node.id}: procedure ${node.procedureName} not found in registry`);
			}
		}

		// Check next nodes exist
		const nextNodes = Array.isArray(node.next) ? node.next : node.next ? [node.next] : [];
		for (const nextId of nextNodes) {
			if (!workflow.nodes.find((n) => n.id === nextId)) {
				errors.push(`Node ${node.id}: next node ${nextId} not found`);
			}
		}
	}

	return errors;
}