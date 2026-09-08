import { describe, expect, it } from "vitest";
import { enqueueWorkflow, startWorkforceWorker, WORKFORCE_QUEUE } from "./queue";

describe("workforce queue", () => {
  it("uses inline transport when REDIS_URL is not configured", async () => {
    const result = await enqueueWorkflow({
      runId: 1,
      ownerId: 1,
      workflowId: 1,
      input: { request: "test" },
      enqueuedAt: new Date().toISOString(),
    });
    expect(result).toEqual({ transport: "inline", queue: WORKFORCE_QUEUE });
  });

  it("does not start a remote worker without Redis", async () => {
    const result = await startWorkforceWorker(async () => undefined);
    expect(result).toEqual({ enabled: false, transport: "inline" });
  });
});
