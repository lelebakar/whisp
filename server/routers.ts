import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDefaultGraphDefinition, runWorkforceGraph, type WorkforcePlan } from "./workforce/orchestration";
import { getWorkspaceSnapshot } from "./db";

const planSchema = {
  type: "object" as const,
  properties: {
    objective: { type: "string" as const },
    summary: { type: "string" as const },
    department: { type: "string" as const },
    selectedAgents: { type: "array" as const, items: { type: "string" as const } },
    steps: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const },
          owner: { type: "string" as const },
          reason: { type: "string" as const },
          needsApproval: { type: "boolean" as const },
        },
        required: ["title", "owner", "reason", "needsApproval"],
        additionalProperties: false,
      },
    },
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
      {
        role: "system",
        content: "You are the AI Right Hand for a digital company. Convert the user's intent into a safe, concrete workforce plan. Select departments and agent roles, identify tools and memory updates, and require approval for external side effects, sensitive data, money, deletion, or public communication. Output JSON only.",
      },
      { role: "user", content: request },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "workforce_plan", strict: true, schema: planSchema },
    },
  });
  const content = getTextContent(response.choices?.[0]?.message?.content);
  return JSON.parse(content) as WorkforcePlan;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  workforce: router({
    graphDefinition: publicProcedure.query(() => getDefaultGraphDefinition()),
    snapshot: protectedProcedure.query(({ ctx }) => getWorkspaceSnapshot(ctx.user.id)),
  }),
  rightHand: router({
    plan: protectedProcedure
      .input(z.object({ request: z.string().min(3).max(12000) }))
      .mutation(async ({ input }) => {
        const plan = await createRightHandPlan(input.request);
        const graphState = await runWorkforceGraph(input.request, plan);
        return { plan, graphState };
      }),
  }),
});

export type AppRouter = typeof appRouter;
