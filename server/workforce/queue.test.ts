import { describe, expect, it } from "vitest";
import { ENV } from "../_core/env";
import { enqueueWorkflow, startWorkforceWorker, WORKFORCE_QUEUE } from "./queue";

describe("workforce queue", () => {
  it("uses the configured transport", async () => {
    const result = await enqueueWorkflow({
      runId: 1,
      ownerId: 1,
      workflowId: 1,
      input: { request: "test" },
      enqueuedAt: new Date().toISOString(),
    });
    expect(result).toEqual({ transport: ENV.redisUrl ? "redis" : "inline", queue: WORKFORCE_QUEUE });
  });

  it.skipIf(Boolean(ENV.redisUrl))("does not start a remote worker without Redis", async () => {
    const result = await startWorkforceWorker(async () => undefined);
    expect(result).toEqual({ enabled: false, transport: "inline" });
  });
});
