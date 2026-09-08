import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

export type WorkforcePlan = {
  objective: string;
  summary: string;
  department: string;
  selectedAgents: string[];
  steps: Array<{ title: string; owner: string; reason: string; needsApproval: boolean }>;
  memoryWrites: string[];
  tools: string[];
  approvalRequired: boolean;
};

const WorkforceState = Annotation.Root({
  request: Annotation<string>,
  plan: Annotation<WorkforcePlan | null>,
  events: Annotation<string[]>({ reducer: (left, right) => left.concat(right), default: () => [] }),
  status: Annotation<"intake" | "planned" | "waiting_approval" | "ready" | "failed">,
});

export type WorkforceStateSnapshot = typeof WorkforceState.State;

const intakeNode = (state: WorkforceStateSnapshot) => ({
  status: "intake" as const,
  events: [`Intake received: ${state.request.slice(0, 120)}`],
});

const routeNode = (state: WorkforceStateSnapshot) => ({
  status: "planned" as const,
  events: ["Right Hand will route the objective to the best-fit department and agent capabilities."],
});

const approvalGateNode = (state: WorkforceStateSnapshot) => ({
  status: state.plan?.approvalRequired ? ("waiting_approval" as const) : ("ready" as const),
  events: [state.plan?.approvalRequired ? "Human approval gate created before high-risk execution." : "No human approval required for this plan."],
});

/**
 * The graph is intentionally small and composable: model planning happens before
 * this graph, while deterministic state transitions, approval gates, and worker
 * handoff happen here. A production worker can attach a Postgres checkpointer and
 * Redis-backed queue without changing the UI contract.
 */
export const workforceGraph = new StateGraph(WorkforceState)
  .addNode("intake", intakeNode)
  .addNode("route", routeNode)
  .addNode("approval_gate", approvalGateNode)
  .addEdge(START, "intake")
  .addEdge("intake", "route")
  .addEdge("route", "approval_gate")
  .addEdge("approval_gate", END)
  .compile();

export async function runWorkforceGraph(request: string, plan: WorkforcePlan | null) {
  return workforceGraph.invoke({
    request,
    plan,
    events: [],
    status: "intake",
  });
}

export function getDefaultGraphDefinition() {
  return {
    engine: "langgraph",
    version: 1,
    nodes: ["intake", "route", "approval_gate", "worker_handoff", "memory_write", "audit"],
    edges: [
      ["START", "intake"],
      ["intake", "route"],
      ["route", "approval_gate"],
      ["approval_gate", "worker_handoff"],
      ["worker_handoff", "memory_write"],
      ["memory_write", "audit"],
      ["audit", "END"],
    ],
    persistence: { checkpointer: "postgres", queue: "redis", eventBus: "sse-or-websocket" },
  };
}
