import type { Express } from "express";
import { invokeLLM, listLLMModels } from "../_core/llm";
import { sdk } from "../_core/sdk";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function registerRightHandStreamRoute(app: Express) {
  app.get("/api/right-hand/stream", async (req, res) => {
    let user = null;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      user = null;
    }
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const request = String(req.query.request ?? "").trim();
    if (request.length < 3 || request.length > 12000) {
      res.status(400).json({ error: "request must contain 3-12000 characters" });
      return;
    }
    res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.flushHeaders();
    let closed = false;
    req.on("close", () => { closed = true; });
    const send = (event: string, payload: Record<string, unknown>) => {
      if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };
    try {
      send("status", { phase: "intake", message: "Right Hand received the objective." });
      await sleep(180);
      send("status", { phase: "routing", message: "Selecting departments, agents, tools, and memory." });
      await sleep(180);
      send("status", { phase: "guardrails", message: "Checking permissions and approval boundaries." });
      const catalog = await listLLMModels();
      const preferred = catalog.data.find((model) => model.id === "gpt-5-mini") ?? catalog.data[0];
      const response = await invokeLLM({
        model: preferred?.id,
        messages: [
          { role: "system", content: "You are Ari, an AI Right Hand and Chief of Staff. Reply in concise Indonesian with a concrete plan. Mention which AI departments should collaborate, the first three execution steps, and whether human approval is needed. Do not claim an action happened. This endpoint streams orchestration progress; keep the final answer under 160 words." },
          { role: "user", content: request },
        ],
      });
      const content = typeof response.choices?.[0]?.message?.content === "string" ? response.choices[0].message.content : "Rencana siap. Saya akan memilih agent terbaik, menjalankan langkah aman, dan meminta approval sebelum tindakan eksternal.";
      send("token", { content });
      send("done", { phase: "ready", model: preferred?.id ?? "default" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Streaming plan failed";
      send("error", { message });
    } finally {
      res.end();
    }
  });
}
