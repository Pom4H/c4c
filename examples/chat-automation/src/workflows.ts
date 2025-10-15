import type { WorkflowDefinition } from "@tsdev/workflow";

// Domain sub-workflow: tickets triage
export const ticketsTriageWorkflow: WorkflowDefinition = {
  id: "tickets.triage",
  name: "Tickets Triage",
  version: "1.0.0",
  startNode: "classify",
  nodes: [
    { id: "classify", type: "procedure", procedureName: "agent.plan", next: "route" },
    {
      id: "route",
      type: "condition",
      config: { expression: "intent === 'tooling'", trueBranch: "createTicket", falseBranch: "compose" }
    },
    { id: "createTicket", type: "procedure", procedureName: "tools.jira.create", next: "compose" },
    { id: "compose", type: "procedure", procedureName: "nlp.compose" }
  ]
};

// System workflow composing domain sub-workflow via `workflow.run`
export const systemWorkflow: WorkflowDefinition = {
  id: "system.chat",
  name: "System Chat Automation",
  version: "1.0.0",
  startNode: "ingest",
  nodes: [
    { id: "ingest", type: "procedure", procedureName: "channels.ingest", next: "normalize" },
    { id: "normalize", type: "procedure", procedureName: "chat.normalize", next: "agentPlan" },
    { id: "agentPlan", type: "procedure", procedureName: "agent.plan", next: "maybePause" },
    {
      id: "maybePause",
      type: "condition",
      config: { expression: "needApproval === true", trueBranch: "pause", falseBranch: "routeByIntent" }
    },
    { id: "pause", type: "procedure", procedureName: "workflow.pause", next: "routeByIntent" },
    {
      id: "routeByIntent",
      type: "condition",
      config: { expression: "intent === 'tooling'", trueBranch: "triageDomain", falseBranch: "compose" }
    },
    {
      id: "triageDomain",
      type: "procedure",
      procedureName: "workflow.run",
      config: { workflowId: "tickets.triage", mergeOutputs: true },
      next: "compose"
    },
    { id: "compose", type: "procedure", procedureName: "nlp.compose", next: "send" },
    { id: "send", type: "procedure", procedureName: "channels.send" }
  ]
};

export const domainWorkflows = new Map<string, WorkflowDefinition>([
  [ticketsTriageWorkflow.id, ticketsTriageWorkflow],
]);
