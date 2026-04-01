import { describe, expect, it } from "vitest";

import { buildContinuePrompt, buildContactSharePrompt } from "./disclosure.js";

describe("disclosure prompts", () => {
  it("buildContinuePrompt mentions mutual consent", () => {
    const text = buildContinuePrompt();

    expect(text).toContain("双方");
  });

  it("buildContactSharePrompt warns about irreversibility", () => {
    const text = buildContactSharePrompt();

    expect(text).toContain("不可逆");
  });
});
