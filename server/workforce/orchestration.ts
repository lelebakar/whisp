import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";
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
let checkpointerPool: Pool | null = null;

export async function getPostgresCheckpointer() {
  if (!ENV.langgraphPostgresUrl) return null;
  if (!checkpointerPromise) {
    checkpointerPromise = (async () => {
      // Keep sslmode=require in the secret. Supabase's pooler chain is not
      // trusted by the WebDev runtime CA bundle, so pg receives an explicit
      // encrypted TLS config while the URL still enforces SSL transport.
      const poolUrl = new URL(ENV.langgraphPostgresUrl);
      poolUrl.searchParams.delete("sslmode");
      poolUrl.searchParams.delete("uselibpqcompat");
      checkpointerPool = new Pool({ connectionString: poolUrl.toString(), ssl: { rejectUnauthorized: false }, max: 5 });
      const checkpointer = new PostgresSaver(checkpointerPool);
      await checkpointer.setup();
      return checkpointer;
    })().catch((error) => {
      console.error("[LangGraph] Postgres checkpointer unavailable; using request-scoped fallback", error);
      void checkpointerPool?.end();
      checkpointerPool = null;
      return null;
    });
  }
  return checkpointerPromise;
}

export async function runWorkforceGraph(request: string, plan: WorkforcePlan | null, threadId = `right-hand-${Date.now()}`, options: { durable?: boolean } = {}) {
  const checkpointer = options.durable === false ? null : await getPostgresCheckpointer();
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
