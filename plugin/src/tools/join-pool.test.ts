import { describe, expect, it, vi } from "vitest";

import { buildJoinPoolTool } from "./join-pool.js";

describe("buildJoinPoolTool", () => {
  it("calls onboard with answers and summary", async () => {
    const onboard = vi.fn(async () => ({ ok: true, profileId: "p-1", facetCount: 3 }));
    const tool = buildJoinPoolTool({ onboard } as never);

    const result = await tool.execute("call-1", {
      answers: { domain: "AI", stance: "optimist" },
      summary: "An AI enthusiast"
    });

    expect(onboard).toHaveBeenCalledWith({
      answers: { domain: "AI", stance: "optimist" },
      summary: "An AI enthusiast"
    });
    expect(result.content[0].text).toContain("profile synced");
  });

  it("calls onboard without summary", async () => {
    const onboard = vi.fn(async () => ({ ok: true, profileId: "p-1", facetCount: 1 }));
    const tool = buildJoinPoolTool({ onboard } as never);

    await tool.execute("call-1", {
      answers: { domain: "fintech" }
    });

    expect(onboard).toHaveBeenCalledWith({
      answers: { domain: "fintech" },
      summary: undefined
    });
  });

  it("handles empty answers", async () => {
    const onboard = vi.fn(async () => ({ ok: true, profileId: "p-1", facetCount: 0 }));
    const tool = buildJoinPoolTool({ onboard } as never);

    await tool.execute("call-1", { answers: {} });

    expect(onboard).toHaveBeenCalledWith({ answers: {}, summary: undefined });
  });

  it("ignores non-string summary values", async () => {
    const onboard = vi.fn(async () => ({ ok: true }));
    const tool = buildJoinPoolTool({ onboard } as never);

    await tool.execute("call-1", {
      answers: {},
      summary: 42
    });

    expect(onboard).toHaveBeenCalledWith({ answers: {}, summary: undefined });
  });
});
