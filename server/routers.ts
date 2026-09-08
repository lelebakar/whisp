import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createAgent,
  createApproval,
  createDepartment,
  createKnowledgeSource,
  createToolRun,
  createWorkflow,
  createWorkflowRun,
  decideApproval,
  ensureBuiltinTools,
  getToolForOwner,
  getWorkflowRunForOwner,
  getWorkspaceSnapshot,
  listAuditLogs,
  updateAgent,
  updateDepartment,
  updateKnowledgeSource,
  updateToolRun,
  updateWorkflow,
  writeAudit,
} from "./db";
import { getDefaultGraphDefinition, getRuntimeInfo, runWorkforceGraph, type WorkforcePlan } from "./workforce/orchestration";
import { enqueueWorkflow } from "./workforce/queue";
import { processWorkflowJob } from "./workforce/worker";

const planSchema = {
  type: "object" as const,
  properties: {
    objective: { type: "string" as const },
    summary: { type: "string" as const },
    department: { type: "string" as const },
    selectedAgents: { type: "array" as const, items: { type: "string" as const } },
    steps: { type: "array" as const, items: { type: "object" as const, properties: { title: { type: "string" as const }, owner: { type: "string" as const }, reason: { type: "string" as const }, needsApproval: { type: "boolean" as const } }, required: ["title", "owner", "reason", "needsApproval"], additionalProperties: false } },
    memoryWrites: { type: "array" as const, items: { type: "string" as const } },
    tools: { type: "array" as const, items: { type: "string" as const } },
    approvalRequired: { type: "boolean" as const },
  },
  required: ["objective", "summary", "department", "selectedAgents", "steps", "memoryWrites", "tools", "approvalRequired"],
  additionalProperties: false,
};

function getTextContent(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((item) => typeof item === "string" ? item : (item as { text?: string }).text ?? "").join("\n");
  return "";
}

async function createRightHandPlan(request: string): Promise<WorkforcePlan> {
  const modelCatalog = await listLLMModels();
  const preferred = modelCatalog.data.find((model) => model.id === "gpt-5-mini") ?? modelCatalog.data.find((model) => model.id.startsWith("claude")) ?? modelCatalog.data[0];
  const response = await invokeLLM({
    model: preferred?.id,
    messages: [
      { role: "system", content: "You are the AI Right Hand for a digital company. Convert the user's intent into a safe, concrete workforce plan. Select departments and agent roles, identify tools and memory updates, and require approval for external side effects, sensitive data, money, deletion, or public communication. Output JSON only." },
      { role: "user", content: request },
    ],
    response_format: { type: "json_schema", json_schema: { name: "workforce_plan", strict: true, schema: planSchema } },
  });
  const content = getTextContent(response.choices?.[0]?.message?.content);
  return JSON.parse(content) as WorkforcePlan;
}

const agentFields = {
  name: z.string().min(2).max(120), role: z.string().min(2).max(160), slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/), avatar: z.string().min(1).max(8), accent: z.string().min(2).max(32), departmentId: z.number().int().positive().optional(), expertise: z.array(z.string().min(1)).max(30), permissions: z.array(z.string().min(1)).max(30), model: z.string().max(120).optional(), systemPrompt: z.string().max(12000).optional(), isRightHand: z.boolean().optional(),
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  workforce: router({
    graphDefinition: publicProcedure.query(() => getDefaultGraphDefinition()),
    runtime: publicProcedure.query(() => getRuntimeInfo()),
    snapshot: protectedProcedure.query(({ ctx }) => getWorkspaceSnapshot(ctx.user.id)),
  }),
  agents: router({
    list: protectedProcedure.query(async ({ ctx }) => (await getWorkspaceSnapshot(ctx.user.id))?.agents ?? []),
    create: protectedProcedure.input(z.object(agentFields)).mutation(({ ctx, input }) => createAgent(ctx.user.id, input)),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ ...agentFields, departmentId: z.number().int().positive().nullable().optional(), status: z.enum(["online", "working", "idle", "offline"]).optional() }).partial() })).mutation(({ ctx, input }) => updateAgent(ctx.user.id, input.id, input.data)),
  }),
  departments: router({
    list: protectedProcedure.query(async ({ ctx }) => (await getWorkspaceSnapshot(ctx.user.id))?.departments ?? []),
    create: protectedProcedure.input(z.object({ name: z.string().min(2).max(120), purpose: z.string().min(3).max(600), color: z.string().min(2).max(32) })).mutation(({ ctx, input }) => createDepartment(ctx.user.id, input)),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ name: z.string().min(2).max(120), purpose: z.string().min(3).max(600), color: z.string().min(2).max(32), status: z.enum(["active", "paused", "archived"]) }).partial() })).mutation(({ ctx, input }) => updateDepartment(ctx.user.id, input.id, input.data)),
  }),
  workflows: router({
    list: protectedProcedure.query(async ({ ctx }) => (await getWorkspaceSnapshot(ctx.user.id))?.workflows ?? []),
    create: protectedProcedure.input(z.object({ name: z.string().min(2).max(180), description: z.string().min(3).max(1200), trigger: z.string().min(2).max(180), departmentId: z.number().int().positive().optional(), requiresApproval: z.boolean(), status: z.enum(["draft", "active", "paused", "archived"]).optional() })).mutation(({ ctx, input }) => createWorkflow(ctx.user.id, input)),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ name: z.string().min(2).max(180), description: z.string().min(3).max(1200), trigger: z.string().min(2).max(180), departmentId: z.number().int().positive().nullable().optional(), requiresApproval: z.boolean(), status: z.enum(["draft", "active", "paused", "archived"]), graphDefinition: z.record(z.string(), z.unknown()) }).partial() })).mutation(({ ctx, input }) => updateWorkflow(ctx.user.id, input.id, input.data)),
    run: protectedProcedure.input(z.object({ workflowId: z.number().int().positive(), input: z.record(z.string(), z.unknown()).default({}) })).mutation(async ({ ctx, input }) => {
      const run = await createWorkflowRun(ctx.user.id, input.workflowId, input.input);
      if (!run) throw new Error("Could not create workflow run");
      const job = { runId: run.id, ownerId: ctx.user.id, workflowId: input.workflowId, input: input.input, enqueuedAt: new Date().toISOString() };
      const queue = await enqueueWorkflow(job);
      if (queue.transport === "inline") void processWorkflowJob(job);
      await writeAudit(ctx.user.id, { action: "workflow.queued", resourceType: "workflow_run", resourceId: String(run.id), details: queue });
      return { run, queue };
    }),
  }),
  knowledge: router({
    list: protectedProcedure.query(async ({ ctx }) => (await getWorkspaceSnapshot(ctx.user.id))?.knowledge ?? []),
    create: protectedProcedure.input(z.object({ title: z.string().min(2).max(220), sourceType: z.enum(["document", "url", "note", "database", "conversation"]), uri: z.string().max(5000).optional(), departmentId: z.number().int().positive().optional(), metadata: z.record(z.string(), z.unknown()).optional() })).mutation(({ ctx, input }) => createKnowledgeSource(ctx.user.id, input)),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: z.object({ title: z.string().min(2).max(220), sourceType: z.enum(["document", "url", "note", "database", "conversation"]), uri: z.string().max(5000).nullable(), departmentId: z.number().int().positive().nullable(), status: z.enum(["ready", "syncing", "error", "archived"]), metadata: z.record(z.string(), z.unknown()) }).partial() })).mutation(({ ctx, input }) => updateKnowledgeSource(ctx.user.id, input.id, input.data)),
  }),
  tools: router({
    list: protectedProcedure.query(({ ctx }) => ensureBuiltinTools(ctx.user.id)),
    execute: protectedProcedure.input(z.object({ name: z.string().min(2), payload: z.record(z.string(), z.unknown()).default({}), agentId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      const tool = await getToolForOwner(ctx.user.id, input.name);
      if (!tool || !tool.enabled) throw new Error("Tool is unavailable or disabled");
      const run = await createToolRun(ctx.user.id, { toolId: tool.id, agentId: input.agentId, payload: input.payload });
      if (!run) throw new Error("Could not create tool run");
      await updateToolRun(run.id, { status: "running", startedAt: new Date() });
      try {
        let result: unknown;
        if (tool.name === "workspace_overview") result = await getWorkspaceSnapshot(ctx.user.id);
        else if (tool.name === "create_knowledge_note") result = await createKnowledgeSource(ctx.user.id, { title: String(input.payload.title ?? "Untitled note"), sourceType: "note", uri: String(input.payload.content ?? ""), metadata: { createdByTool: true } });
        else if (tool.name === "request_human_approval") result = await createApproval(ctx.user.id, { action: String(input.payload.action ?? "Review requested action"), rationale: String(input.payload.rationale ?? "Requested by an agent tool."), payload: input.payload });
        else throw new Error("No handler registered for this tool");
        await updateToolRun(run.id, { status: "completed", output: { result }, completedAt: new Date() });
        await writeAudit(ctx.user.id, { action: "tool.completed", resourceType: "tool_run", resourceId: String(run.id), details: { tool: tool.name } });
        return { runId: run.id, tool: tool.name, result };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Tool execution failed";
        await updateToolRun(run.id, { status: "failed", error: message, completedAt: new Date() });
        await writeAudit(ctx.user.id, { action: "tool.failed", resourceType: "tool_run", resourceId: String(run.id), outcome: "failed", details: { tool: tool.name, error: message } });
        throw error;
      }
    }),
  }),
  approvals: router({
    list: protectedProcedure.query(async ({ ctx }) => (await getWorkspaceSnapshot(ctx.user.id))?.approvals ?? []),
    decide: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]) })).mutation(async ({ ctx, input }) => {
      const approval = await decideApproval(ctx.user.id, input.id, input.status);
      if (!approval) throw new Error("Approval not found or already decided");
      if (input.status === "approved" && approval.workflowRunId) {
        const run = await getWorkflowRunForOwner(ctx.user.id, approval.workflowRunId);
        if (run) {
          const job = { runId: run.id, ownerId: ctx.user.id, workflowId: run.workflowId, input: (run.input ?? {}) as Record<string, unknown>, enqueuedAt: new Date().toISOString() };
          const queue = await enqueueWorkflow(job);
          if (queue.transport === "inline") void processWorkflowJob(job);
        }
      }
      return approval;
    }),
  }),
  audit: router({ list: protectedProcedure.query(({ ctx }) => listAuditLogs(ctx.user.id)) }),
  rightHand: router({
    plan: protectedProcedure.input(z.object({ request: z.string().min(3).max(12000) })).mutation(async ({ ctx, input }) => {
      const plan = await createRightHandPlan(input.request);
      const graphState = await runWorkforceGraph(input.request, plan);
      const approval = plan.approvalRequired ? await createApproval(ctx.user.id, { action: plan.steps.find((step) => step.needsApproval)?.title ?? "Review Right Hand plan", rationale: "The plan contains a high-risk or external side effect.", payload: { request: input.request, plan } }) : null;
      await writeAudit(ctx.user.id, { action: "right_hand.plan_created", resourceType: "right_hand_plan", outcome: approval ? "pending" : "success", details: { request: input.request, selectedAgents: plan.selectedAgents } });
      return { plan, graphState, approval };
    }),
  }),
});

export type AppRouter = typeof appRouter;
