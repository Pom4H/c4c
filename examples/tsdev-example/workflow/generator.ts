/**
 * Workflow UI and Configuration Generator
 * 
 * Automatically generates workflow editor UI config from procedures
 */

import type { Registry } from "../core/types.js";
import type { NodeMetadata, WorkflowUIConfig } from "../core/workflow/types.js";

/**
 * Generate workflow UI configuration from registry
 * This creates the node palette for a visual workflow editor
 */
export function generateWorkflowUI(registry: Registry): WorkflowUIConfig {
	const nodes: NodeMetadata[] = [];
	const categories = new Set<string>();

	// Convert each procedure to a workflow node
	for (const [name, procedure] of registry.entries()) {
		const category = getCategoryFromProcedureName(name);
		categories.add(category);

		const nodeMetadata: NodeMetadata = {
			id: name,
			name: formatNodeName(name),
			description: procedure.contract.description,
			category,
			icon: getIconForCategory(category),
			color: getColorForCategory(category),
			inputSchema: procedure.contract.input,
			outputSchema: procedure.contract.output,
		};

		nodes.push(nodeMetadata);
	}

	return {
		nodes,
		categories: Array.from(categories).sort(),
		connections: [], // Will be filled when building actual workflows
	};
}

/**
 * Generate React Flow compatible nodes configuration
 * For visual workflow editors like React Flow, Rete.js, etc.
 */
export function generateReactFlowConfig(registry: Registry) {
	const nodeTypes: Record<string, unknown> = {};

	for (const [name, procedure] of registry.entries()) {
		const category = getCategoryFromProcedureName(name);

		nodeTypes[name] = {
			type: "procedure",
			data: {
				label: formatNodeName(name),
				description: procedure.contract.description,
				category,
				inputs: extractInputPorts(procedure.contract.input),
				outputs: extractOutputPorts(procedure.contract.output),
				config: {
					procedureName: name,
					inputSchema: procedure.contract.input,
					outputSchema: procedure.contract.output,
				},
			},
			style: {
				background: getColorForCategory(category),
				color: "#fff",
				border: "1px solid #222",
				borderRadius: "8px",
				padding: "10px",
			},
		};
	}

	return {
		nodeTypes,
		edgeTypes: {
			default: {
				type: "smoothstep",
				animated: true,
			},
		},
	};
}

/**
 * Generate n8n-style node configuration
 * Compatible with n8n workflow editor
 */
export function generateN8NConfig(registry: Registry) {
	const nodes = [];

	for (const [name, procedure] of registry.entries()) {
		const category = getCategoryFromProcedureName(name);

		nodes.push({
			name,
			displayName: formatNodeName(name),
			description: procedure.contract.description || `Execute ${name} procedure`,
			group: [category],
			version: 1,
			defaults: {
				name: formatNodeName(name),
			},
			inputs: ["main"],
			outputs: ["main"],
			properties: extractN8NProperties(procedure.contract.input),
		});
	}

	return nodes;
}

/**
 * Generate mermaid diagram syntax for workflow visualization
 */
export function generateMermaidDiagram(registry: Registry): string {
	let diagram = "graph TD\n";

	for (const [name] of registry.entries()) {
		const nodeId = name.replace(/\./g, "_");
		const label = formatNodeName(name);
		diagram += `    ${nodeId}[${label}]\n`;
	}

	return diagram;
}

/**
 * Extract category from procedure name (e.g., "users.create" -> "users")
 */
function getCategoryFromProcedureName(name: string): string {
	const parts = name.split(".");
	return parts[0] || "general";
}

/**
 * Format procedure name for display (e.g., "users.create" -> "Create User")
 */
function formatNodeName(name: string): string {
	const parts = name.split(".");
	if (parts.length < 2) return name;

	const action = parts[1] || "";
	const resource = parts[0] || "";

	return `${capitalize(action)} ${capitalize(resource)}`;
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get icon for category
 */
function getIconForCategory(category: string): string {
	const icons: Record<string, string> = {
		users: "👤",
		posts: "📝",
		auth: "🔐",
		payments: "💳",
		emails: "📧",
		storage: "💾",
		analytics: "📊",
		math: "🔢",
		general: "⚙️",
	};

	return icons[category] || "⚙️";
}

/**
 * Get color for category
 */
function getColorForCategory(category: string): string {
	const colors: Record<string, string> = {
		users: "#3b82f6",
		posts: "#8b5cf6",
		auth: "#ef4444",
		payments: "#10b981",
		emails: "#f59e0b",
		storage: "#6366f1",
		analytics: "#ec4899",
		math: "#14b8a6",
		general: "#6b7280",
	};

	return colors[category] || "#6b7280";
}

/**
 * Extract input ports from Zod schema
 */
function extractInputPorts(schema: unknown): Array<{ id: string; label: string; type: string }> {
	// Simplified - in production, parse Zod schema properly
	return [
		{
			id: "input",
			label: "Input",
			type: "object",
		},
	];
}

/**
 * Extract output ports from Zod schema
 */
function extractOutputPorts(schema: unknown): Array<{ id: string; label: string; type: string }> {
	// Simplified - in production, parse Zod schema properly
	return [
		{
			id: "output",
			label: "Output",
			type: "object",
		},
	];
}

/**
 * Extract n8n properties from Zod schema
 */
function extractN8NProperties(schema: unknown): unknown[] {
	// Simplified - in production, parse Zod schema and convert to n8n properties
	return [
		{
			displayName: "Input",
			name: "input",
			type: "json",
			default: "{}",
			description: "Input data for the procedure",
		},
	];
}

/**
 * Generate HTML for workflow visualization
 */
export function generateWorkflowHTML(registry: Registry): string {
	const uiConfig = generateWorkflowUI(registry);

	return `
<!DOCTYPE html>
<html>
<head>
	<title>Workflow Builder - tsdev</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			margin: 0;
			padding: 20px;
			background: #f5f5f5;
		}
		.palette {
			background: white;
			border-radius: 8px;
			padding: 20px;
			margin-bottom: 20px;
		}
		.category {
			margin-bottom: 20px;
		}
		.category-title {
			font-weight: 600;
			margin-bottom: 10px;
			color: #333;
		}
		.node-card {
			background: white;
			border: 2px solid #e5e7eb;
			border-radius: 6px;
			padding: 12px;
			margin: 8px 0;
			cursor: move;
			transition: all 0.2s;
		}
		.node-card:hover {
			border-color: #3b82f6;
			box-shadow: 0 4px 6px rgba(0,0,0,0.1);
		}
		.node-title {
			font-weight: 500;
			margin-bottom: 4px;
		}
		.node-description {
			font-size: 12px;
			color: #6b7280;
		}
	</style>
</head>
<body>
	<h1>🔄 Workflow Node Palette</h1>
	<p>Drag these nodes to build workflows. Each node is a procedure from your registry.</p>
	
	<div class="palette">
		${generateCategoryHTML(uiConfig)}
	</div>

	<script>
		// Node palette data
		const nodes = ${JSON.stringify(uiConfig.nodes, null, 2)};
		
		console.log('Available workflow nodes:', nodes);
		
		// Add drag handlers
		document.querySelectorAll('.node-card').forEach(card => {
			card.addEventListener('dragstart', (e) => {
				const nodeId = card.dataset.nodeId;
				const node = nodes.find(n => n.id === nodeId);
				e.dataTransfer.setData('application/json', JSON.stringify(node));
			});
		});
	</script>
</body>
</html>
`;
}

/**
 * Generate HTML for categories
 */
function generateCategoryHTML(uiConfig: WorkflowUIConfig): string {
	const nodesByCategory = new Map<string, NodeMetadata[]>();

	for (const node of uiConfig.nodes) {
		const category = node.category;
		if (!nodesByCategory.has(category)) {
			nodesByCategory.set(category, []);
		}
		nodesByCategory.get(category)?.push(node);
	}

	let html = "";

	for (const [category, nodes] of nodesByCategory.entries()) {
		html += `
		<div class="category">
			<div class="category-title">${getIconForCategory(category)} ${capitalize(category)}</div>
			${nodes
				.map(
					(node) => `
			<div class="node-card" draggable="true" data-node-id="${node.id}" style="border-color: ${node.color}">
				<div class="node-title">${node.icon || ""} ${node.name}</div>
				<div class="node-description">${node.description || "No description"}</div>
			</div>
			`
				)
				.join("")}
		</div>
		`;
	}

	return html;
}
