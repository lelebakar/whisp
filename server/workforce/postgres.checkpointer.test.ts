import { describe, expect, it } from "vitest";
import { ENV } from "../_core/env";
import { getPostgresCheckpointer } from "./orchestration";

describe("LangGraph Postgres checkpointer", () => {
  it("connects and initializes when configured", async () => {
    expect(ENV.langgraphPostgresUrl).toMatch(/^postgres(ql)?:\/\//);
    const saver = await getPostgresCheckpointer();
    expect(saver).not.toBeNull();
  }, 30_000);
});
