import Redis from "ioredis";
import { ENV } from "../_core/env";

export const WORKFORCE_QUEUE = "whisp:workforce:workflow-runs";

export type WorkflowJob = {
  runId: number;
  ownerId: number;
  workflowId: number;
  input: Record<string, unknown>;
  enqueuedAt: string;
};

let redisClient: Redis | null = null;

function getRedis() {
  if (!ENV.redisUrl) return null;
  if (!redisClient) {
    redisClient = new Redis(ENV.redisUrl, { maxRetriesPerRequest: null, lazyConnect: true });
    redisClient.on("error", (error) => console.error("[Redis] workforce queue error", error.message));
  }
  return redisClient;
}

async function ensureRedis() {
  const redis = getRedis();
  if (!redis) return null;
  if (redis.status === "wait") await redis.connect();
  return redis;
}

export async function enqueueWorkflow(job: WorkflowJob) {
  const redis = await ensureRedis();
  if (!redis) return { transport: "inline" as const, queue: WORKFORCE_QUEUE };
  await redis.lpush(WORKFORCE_QUEUE, JSON.stringify(job));
  return { transport: "redis" as const, queue: WORKFORCE_QUEUE };
}

export async function startWorkforceWorker(processJob: (job: WorkflowJob) => Promise<void>) {
  const redis = await ensureRedis();
  if (!redis) {
    console.info("[Workforce] REDIS_URL not configured; background runs use inline execution.");
    return { enabled: false as const, transport: "inline" as const };
  }
  const consume = async () => {
    console.info(`[Workforce] Redis worker listening on ${WORKFORCE_QUEUE}`);
    while (true) {
      try {
        const result = await redis.brpop(WORKFORCE_QUEUE, 0);
        const raw = Array.isArray(result) ? result[1] : result;
        if (raw) await processJob(JSON.parse(raw) as WorkflowJob);
      } catch (error) {
        console.error("[Workforce] Worker iteration failed", error);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  };
  void consume();
  return { enabled: true as const, transport: "redis" as const };
}

export async function closeWorkforceQueue() {
  if (redisClient) await redisClient.quit();
  redisClient = null;
}
