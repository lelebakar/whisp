import { describe, expect, it } from "vitest";
import { getDefaultGraphDefinition, runWorkforceGraph, type WorkforcePlan } from "./orchestration";

describe("workforce orchestration graph", () => {
  it("moves a plan through intake, routing, and a safe ready state", async () => {
    const plan: WorkforcePlan = {
      objective: "Prepare a weekly executive pulse",
      summary: "Coordinate a concise company update.",
      department: "Executive Office",
      selectedAgents: ["Ari"],
      steps: [{ title: "Synthesize signals", owner: "Ari", reason: "Right Hand context", needsApproval: false }],
      memoryWrites: ["Weekly pulse format"],
      tools: ["workspace_analytics"],
      approvalRequired: false,
    };
    const state = await runWorkforceGraph("Prepare a weekly executive pulse", plan, undefined, { durable: false });
    expect(state.status).toBe("ready");
    expect(state.events).toHaveLength(3);
    expect(state.events[1]).toContain("route");
  });

  it("keeps high-risk plans behind a human approval gate", async () => {
    const plan: WorkforcePlan = {
      objective: "Send an external campaign",
      summary: "Review and send campaign.",
      department: "Growth & Marketing",
      selectedAgents: ["Mira"],
      steps: [{ title: "Send campaign", owner: "Mira", reason: "External action", needsApproval: true }],
      memoryWrites: [],
      tools: ["email_sender"],
      approvalRequired: true,
    };
    const state = await runWorkforceGraph("Send the campaign", plan, undefined, { durable: false });
    expect(state.status).toBe("waiting_approval");
    expect(state.events.at(-1)).toContain("approval gate");
  });

  it("publishes a serializable graph definition for durable workflow storage", () => {
    const definition = getDefaultGraphDefinition();
    expect(definition.engine).toBe("langgraph");
    expect(definition.nodes).toContain("approval_gate");
    expect(definition.persistence.checkpointer).toBe("postgres");
    expect(definition.persistence.queue).toBe("redis");
  });
});
