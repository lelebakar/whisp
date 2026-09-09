import { describe, expect, it } from "vitest";
import Redis from "ioredis";
import { ENV } from "../_core/env";
import { getPostgresCheckpointer, runWorkforceGraph } from "./orchestration";

describe("durable workforce infrastructure", () => {
  it("connects to LangGraph PostgreSQL checkpointer", async () => {
    expect(ENV.langgraphPostgresUrl).toMatch(/^postgres(ql)?:\/\//);
    const saver = await getPostgresCheckpointer();
    expect(saver).not.toBeNull();
    const state = await runWorkforceGraph("Infrastructure verification", null, `infra-test-${Date.now()}`, { durable: true });
    expect(state.status).toBe("ready");
    await saver.setup();
    expect(saver).toBeDefined();
    await saver.end();
  }, 30_000);

  it("connects to Redis worker queue", async () => {
    expect(ENV.redisUrl).toMatch(/^rediss?:\/\//);
    const redis = new Redis(ENV.redisUrl, { lazyConnect: true, connectTimeout: 10_000, maxRetriesPerRequest: 1 });
    await redis.connect();
    expect(await redis.ping()).toBe("PONG");
    await redis.quit();
  }, 20_000);
});
