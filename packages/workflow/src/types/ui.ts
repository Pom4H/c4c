/**
 * UI and Metadata Types
 * 
 * Defines types for workflow UI generation and metadata
 */

import type { z } from "zod";

/**
 * Node metadata for UI generation
 */
export interface NodeMetadata {
	id: string;
	name: string;
	description?: string;
	category: string;
	icon?: string;
	color?: string;
	inputSchema: z.ZodType;
	outputSchema: z.ZodType;
	configSchema?: z.ZodType; // Node-specific configuration
	examples?: Array<{
		input: unknown;
		output: unknown;
	}>;
}

/**
 * Workflow UI configuration
 */
export interface WorkflowUIConfig {
	nodes: NodeMetadata[];
	categories: string[];
	connections: Array<{
		from: string;
		to: string;
		fromPort?: string;
		toPort?: string;
	}>;
}