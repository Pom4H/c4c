/**
 * Node Configuration Types
 * 
 * Defines types for different workflow node configurations
 */

import type { z } from "zod";

/**
 * Condition node configuration
 */
export interface ConditionPredicateContext {
	variables: Record<string, unknown>;
	outputs: Map<string, unknown>;
	get<T = unknown>(key: string): T | undefined;
	inputData?: unknown;
}

export type ConditionPredicate = (context: ConditionPredicateContext) => boolean;

export interface ConditionConfig {
	expression?: string; // JavaScript expression
	trueBranch: string; // Node ID for true
	falseBranch: string; // Node ID for false
	predicateFn?: ConditionPredicate; // Optional runtime predicate
}

/**
 * Parallel execution configuration
 */
export interface ParallelConfig {
	branches: string[]; // Node IDs to execute in parallel
	waitForAll: boolean; // Wait for all branches or first completion
}

/**
 * Sub-workflow runner configuration (for procedure-based subworkflow node)
 */
export interface SubWorkflowConfig {
	workflowId: string;
	input?: Record<string, unknown>;
	mergeOutputs?: boolean; // if true, return child outputs directly
}