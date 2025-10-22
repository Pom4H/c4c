/**
 * Configuration for the workflow UI
 * Gets API base URL from environment variables set by the CLI
 */

export const config = {
	apiBase: process.env.NEXT_PUBLIC_C4C_API_BASE || process.env.C4C_API_BASE || "http://localhost:3000",
	workflowStreamBase: process.env.NEXT_PUBLIC_C4C_WORKFLOW_STREAM_BASE || `${process.env.NEXT_PUBLIC_C4C_API_BASE || "http://localhost:3000"}/workflow/executions`,
};
