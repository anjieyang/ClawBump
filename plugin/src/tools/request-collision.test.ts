import { describe, expect, it, vi } from "vitest";

import { buildRequestCollisionTool } from "./request-collision.js";

describe("buildRequestCollisionTool", () => {
  it("sends all params through to requestCollision", async () => {
    const requestCollision = vi.fn(async () => ({ mode: "deferred", requestId: "r-1" }));
    const tool = buildRequestCollisionTool({ requestCollision } as never);

    const result = await tool.execute("call-1", {
      topic: "AI agents",
      constraint: "no crypto",
      audienceSegment: "tech",
      mode: "filtered"
    });

    expect(requestCollision).toHaveBeenCalledWith({
      topic: "AI agents",
      constraint: "no crypto",
      audienceSegment: "tech",
      mode: "filtered"
    });
    expect(result.content[0].text).toContain("match request submitted");
  });

  it("defaults mode to blind when not filtered", async () => {
    const requestCollision = vi.fn(async () => ({ mode: "deferred" }));
    const tool = buildRequestCollisionTool({ requestCollision } as never);

    await tool.execute("call-1", {});

    expect(requestCollision).toHaveBeenCalledWith({
      topic: undefined,
      constraint: undefined,
      audienceSegment: undefined,
      mode: "blind"
    });
  });

  it("defaults mode to blind for unknown mode string", async () => {
    const requestCollision = vi.fn(async () => ({ mode: "deferred" }));
    const tool = buildRequestCollisionTool({ requestCollision } as never);

    await tool.execute("call-1", { mode: "invalid" });

    expect(requestCollision).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "blind" })
    );
  });

  it("ignores non-string param values", async () => {
    const requestCollision = vi.fn(async () => ({ mode: "deferred" }));
    const tool = buildRequestCollisionTool({ requestCollision } as never);

    await tool.execute("call-1", {
      topic: 42,
      constraint: true,
      audienceSegment: null
    });

    expect(requestCollision).toHaveBeenCalledWith({
      topic: undefined,
      constraint: undefined,
      audienceSegment: undefined,
      mode: "blind"
    });
  });
});
