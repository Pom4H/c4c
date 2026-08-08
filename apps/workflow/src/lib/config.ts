/**
 * Runtime configuration for the useworkflow.dev integration.
 */

const DEFAULT_API_BASE = "http://localhost:8787";

const apiBase =
  process.env.NEXT_PUBLIC_USEWORKFLOW_API_BASE ||
  process.env.USEWORKFLOW_API_BASE ||
  DEFAULT_API_BASE;

const streamBase =
  process.env.NEXT_PUBLIC_USEWORKFLOW_STREAM_BASE ||
  process.env.USEWORKFLOW_STREAM_BASE ||
  `${apiBase.replace(/\/$/, "")}/runs`;

export const config = {
  useWorkflowApiBase: apiBase.replace(/\/$/, ""),
  useWorkflowStreamBase: streamBase.replace(/\/$/, ""),
};
