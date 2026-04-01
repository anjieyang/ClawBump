import { describe, expect, it } from "vitest";

import { parseControlInput } from "./control-parser.js";

const ADDRESS = "龙虾";

describe("parseControlInput", () => {
  // --- peer content ---

  it("treats ordinary text as peer content by default", () => {
    const parsed = parseControlInput({
      text: "我觉得你这个观点挺有意思，但证据还不够。",
      assistantAddress: ADDRESS
    });

    expect(parsed).toEqual({
      kind: "peer",
      rawText: "我觉得你这个观点挺有意思，但证据还不够。",
      body: "我觉得你这个观点挺有意思，但证据还不够。"
    });
  });

  it("treats single character text as peer", () => {
    const parsed = parseControlInput({ text: "好", assistantAddress: ADDRESS });

    expect(parsed.kind).toBe("peer");
  });

  it("treats English text as peer", () => {
    const parsed = parseControlInput({
      text: "I think that's an interesting point",
      assistantAddress: ADDRESS
    });

    expect(parsed.kind).toBe("peer");
  });

  it("treats emoji as peer content", () => {
    const parsed = parseControlInput({ text: "👍", assistantAddress: ADDRESS });

    expect(parsed.kind).toBe("peer");
  });

  it("treats empty string as peer content", () => {
    const parsed = parseControlInput({ text: "", assistantAddress: ADDRESS });

    expect(parsed.kind).toBe("peer");
    expect(parsed.kind === "peer" && parsed.body).toBe("");
  });

  it("treats whitespace-only as peer content (trimmed to empty)", () => {
    const parsed = parseControlInput({ text: "   ", assistantAddress: ADDRESS });

    expect(parsed.kind).toBe("peer");
  });

  // --- slash commands ---

  it("treats slash commands as assistant instructions", () => {
    const parsed = parseControlInput({ text: "/bump contact", assistantAddress: ADDRESS });

    expect(parsed.kind).toBe("assistant");
    if (parsed.kind === "assistant") {
      expect(parsed.mode).toBe("slash");
      expect(parsed.body).toBe("/bump contact");
    }
  });

  it("treats bare slash as assistant instruction", () => {
    const parsed = parseControlInput({ text: "/help", assistantAddress: ADDRESS });

    expect(parsed.kind).toBe("assistant");
  });

  it("trims leading whitespace before detecting slash", () => {
    const parsed = parseControlInput({ text: "  /bump find", assistantAddress: ADDRESS });

    expect(parsed.kind).toBe("assistant");
  });

  // --- explicitly addressed ---

  it("detects address with Chinese comma separator", () => {
    const parsed = parseControlInput({
      text: "龙虾，帮我委婉一点：我不同意。",
      assistantAddress: ADDRESS
    });

    expect(parsed).toEqual({
      kind: "assistant",
      mode: "addressed",
      rawText: "龙虾，帮我委婉一点：我不同意。",
      body: "帮我委婉一点：我不同意。"
    });
  });

  it("detects address with space separator", () => {
    const parsed = parseControlInput({
      text: "龙虾 帮我查一下",
      assistantAddress: ADDRESS
    });

    expect(parsed.kind).toBe("assistant");
    if (parsed.kind === "assistant") {
      expect(parsed.mode).toBe("addressed");
      expect(parsed.body).toBe("帮我查一下");
    }
  });

  it("detects address with colon separator", () => {
    const parsed = parseControlInput({
      text: "龙虾：翻译一下",
      assistantAddress: ADDRESS
    });

    expect(parsed.kind).toBe("assistant");
    if (parsed.kind === "assistant") {
      expect(parsed.body).toBe("翻译一下");
    }
  });

  it("detects address with English comma", () => {
    const parsed = parseControlInput({
      text: "龙虾, translate this",
      assistantAddress: ADDRESS
    });

    expect(parsed.kind).toBe("assistant");
  });

  it("does NOT detect address embedded in the middle of text", () => {
    const parsed = parseControlInput({
      text: "我跟龙虾说过了",
      assistantAddress: ADDRESS
    });

    expect(parsed.kind).toBe("peer");
  });

  it("uses custom assistant address", () => {
    const parsed = parseControlInput({
      text: "小助手，帮我看看",
      assistantAddress: "小助手"
    });

    expect(parsed.kind).toBe("assistant");
    if (parsed.kind === "assistant") {
      expect(parsed.body).toBe("帮我看看");
    }
  });

  it("returns empty body when addressed with nothing after", () => {
    const parsed = parseControlInput({
      text: "龙虾，",
      assistantAddress: ADDRESS
    });

    expect(parsed.kind).toBe("assistant");
    if (parsed.kind === "assistant") {
      expect(parsed.body).toBe("");
    }
  });

  // --- ambiguous patterns ---

  it("flags 帮我 as ambiguous", () => {
    expect(parseControlInput({ text: "帮我委婉一点问", assistantAddress: ADDRESS }).kind).toBe("ambiguous");
  });

  it("flags 先别发 as ambiguous", () => {
    expect(parseControlInput({ text: "先别发这条", assistantAddress: ADDRESS }).kind).toBe("ambiguous");
  });

  it("flags 别发 as ambiguous", () => {
    expect(parseControlInput({ text: "别发了", assistantAddress: ADDRESS }).kind).toBe("ambiguous");
  });

  it("flags 不要发 as ambiguous", () => {
    expect(parseControlInput({ text: "不要发给对方", assistantAddress: ADDRESS }).kind).toBe("ambiguous");
  });

  it("flags 替我 as ambiguous", () => {
    expect(parseControlInput({ text: "替我问一下", assistantAddress: ADDRESS }).kind).toBe("ambiguous");
  });

  it("flags 提议解锁 as ambiguous", () => {
    expect(parseControlInput({ text: "提议解锁联系方式", assistantAddress: ADDRESS }).kind).toBe("ambiguous");
  });

  it("flags 解锁轮廓 as ambiguous", () => {
    expect(parseControlInput({ text: "解锁轮廓看看", assistantAddress: ADDRESS }).kind).toBe("ambiguous");
  });

  it("flags 交换联系方式 as ambiguous", () => {
    expect(parseControlInput({ text: "交换联系方式吧", assistantAddress: ADDRESS }).kind).toBe("ambiguous");
  });

  it("flags 想一个 as ambiguous", () => {
    expect(parseControlInput({ text: "想一个好的开场白", assistantAddress: ADDRESS }).kind).toBe("ambiguous");
  });

  it("does NOT flag ambiguous pattern in the middle of text", () => {
    // "帮我" must be at the start (^帮我)
    const parsed = parseControlInput({
      text: "你能帮我看看吗",
      assistantAddress: ADDRESS
    });

    expect(parsed.kind).toBe("peer");
  });

  // --- priority: address > ambiguous ---

  it("address wins over ambiguous when explicitly addressed", () => {
    const parsed = parseControlInput({
      text: "龙虾，帮我查一下",
      assistantAddress: ADDRESS
    });

    expect(parsed.kind).toBe("assistant");
  });
});
