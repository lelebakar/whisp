import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { ENV } from "../_core/env";

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

const routeNode = () => ({
  status: "planned" as const,
  events: ["Right Hand will route the objective to the best-fit department and agent capabilities."],
});

const approvalGateNode = (state: WorkforceStateSnapshot) => ({
  status: state.plan?.approvalRequired ? ("waiting_approval" as const) : ("ready" as const),
  events: [state.plan?.approvalRequired ? "Human approval gate created before high-risk execution." : "No human approval required for this plan."],
});

function buildWorkforceGraph(checkpointer?: unknown) {
  return new StateGraph(WorkforceState)
    .addNode("intake", intakeNode)
    .addNode("route", routeNode)
    .addNode("approval_gate", approvalGateNode)
    .addEdge(START, "intake")
    .addEdge("intake", "route")
    .addEdge("route", "approval_gate")
    .addEdge("approval_gate", END)
    .compile(checkpointer ? { checkpointer: checkpointer as never } : undefined);
}

export const workforceGraph = buildWorkforceGraph();

let checkpointerPromise: Promise<PostgresSaver | null> | null = null;

async function getPostgresCheckpointer() {
  if (!ENV.langgraphPostgresUrl) return null;
  if (!checkpointerPromise) {
    checkpointerPromise = (async () => {
      const checkpointer = PostgresSaver.fromConnString(ENV.langgraphPostgresUrl);
      await checkpointer.setup();
      return checkpointer;
    })().catch((error) => {
      console.error("[LangGraph] Postgres checkpointer unavailable; using request-scoped fallback", error);
      return null;
    });
  }
  return checkpointerPromise;
}

export async function runWorkforceGraph(request: string, plan: WorkforcePlan | null, threadId = `right-hand-${Date.now()}`) {
  const checkpointer = await getPostgresCheckpointer();
  const graph = checkpointer ? buildWorkforceGraph(checkpointer) : workforceGraph;
  return graph.invoke({ request, plan, events: [], status: "intake" }, { configurable: { thread_id: threadId } });
}

export function getRuntimeInfo() {
  return {
    graph: "langgraph",
    checkpointer: ENV.langgraphPostgresUrl ? "postgres" : "memory-fallback",
    redisQueue: ENV.redisUrl ? "redis" : "inline-fallback",
  } as const;
}

export function getDefaultGraphDefinition() {
  return {
    engine: "langgraph",
    version: 2,
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
