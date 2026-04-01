import { describe, expect, it } from "vitest";

import { buildCollisionOpener, buildShadowIntro } from "./opener.js";

describe("opener helpers", () => {
  it("builds a shadow intro without identity leakage", () => {
    expect(buildShadowIntro("一个深夜活跃的技术人，喜欢争论 agent 设计")).toContain("新影子");
  });

  it("builds a soft collision opener", () => {
    const opener = buildCollisionOpener({
      sharedContext: "你们都对 AI agent 很上头",
      differenceHint: "agent 到底该多自主"
    });

    expect(opener).toContain("轻一点的切口");
    expect(opener).toContain("agent 到底该多自主");
  });
});

