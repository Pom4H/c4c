import { z } from "zod";
import type { Registry, Procedure } from "@tsdev/core";
import { createSubworkflowProcedure, PauseSignal } from "@tsdev/workflow";
import { domainWorkflows } from "./workflows.js";

export function createMockRegistry(): Registry {
  const registry: Registry = new Map();

  function add<TI, TO>(proc: Procedure<TI, TO>) {
    registry.set(proc.contract.name, proc);
  }

  // Channels (trigger + send)
  add({
    contract: { name: "channels.ingest", input: z.record(z.unknown()), output: z.record(z.unknown()) },
    handler: async (input) => ({ messageId: `msg_${Date.now()}`, ...input })
  });
  add({
    contract: { name: "channels.send", input: z.object({ channel: z.string(), text: z.string() }), output: z.object({ ok: z.boolean() }) },
    handler: async () => ({ ok: true })
  });

  // Chat normalize
  add({
    contract: { name: "chat.normalize", input: z.record(z.unknown()), output: z.record(z.unknown()) },
    handler: async (input) => ({ text: String(input.text ?? ""), user: input.user ?? "u" })
  });

  // Agent (configurable)
  add({
    contract: { name: "agent.plan", input: z.record(z.unknown()), output: z.record(z.unknown()) },
    handler: async (input) => {
      // simple rule: if text contains "ticket" → need tool; else compose
      const text = String(input.text ?? "").toLowerCase();
      const needTool = text.includes("ticket");
      const needApproval = text.includes("approve");
      return { intent: needTool ? "tooling" : "reply", tool: needTool ? "jira.create" : null, needApproval };
    }
  });

  // Tools
  add({
    contract: { name: "tools.jira.create", input: z.record(z.unknown()), output: z.record(z.unknown()) },
    handler: async (input) => ({ ticketId: `JIRA-${Math.floor(Math.random()*1000)}`, summary: input.text ?? "" })
  });

  // Compose reply
  add({
    contract: { name: "nlp.compose", input: z.record(z.unknown()), output: z.object({ text: z.string() }) },
    handler: async (input) => ({ text: input.tool ? `Created ${input.tool} successfully.` : `Reply: ${input.text ?? ""}` })
  });

  // Sub-workflow runner registered as a procedure
  add(createSubworkflowProcedure(domainWorkflows));

  // Pause helper
  add({
    contract: { name: "workflow.pause", input: z.record(z.unknown()), output: z.record(z.unknown()) },
    handler: async (input) => {
      throw new PauseSignal("await_approval", { suggestedAction: "approve_plan", plan: input });
    }
  });

  return registry;
}
