import { describe, expect, it, vi } from "vitest";

import { buildSessionActionsTool } from "./session-actions.js";

describe("buildSessionActionsTool", () => {
  it("routes report actions to the report endpoint", async () => {
    const reportSession = vi.fn(async () => ({ ok: true }));
    const sessionAction = vi.fn(async () => ({ ok: true }));
    const tool = buildSessionActionsTool({
      reportSession,
      sessionAction
    } as never);

    await tool.execute("call-1", {
      sessionId: "session-1",
      action: "report_session",
      reportReason: "abuse"
    });

    expect(reportSession).toHaveBeenCalledWith({
      sessionId: "session-1",
      action: "report_session",
      reportReason: "abuse",
      reportDetail: undefined
    });
    expect(sessionAction).not.toHaveBeenCalled();
  });

  it("routes report with detail", async () => {
    const reportSession = vi.fn(async () => ({ ok: true }));
    const tool = buildSessionActionsTool({
      reportSession,
      sessionAction: vi.fn()
    } as never);

    await tool.execute("call-1", {
      sessionId: "s-1",
      action: "report_session",
      reportReason: "spam",
      reportDetail: "keeps sending links"
    });

    expect(reportSession).toHaveBeenCalledWith(
      expect.objectContaining({
        reportReason: "spam",
        reportDetail: "keeps sending links"
      })
    );
  });

  it("routes ordinary high-risk actions through sessionAction", async () => {
    const reportSession = vi.fn(async () => ({ ok: true }));
    const sessionAction = vi.fn(async () => ({ ok: true }));
    const tool = buildSessionActionsTool({
      reportSession,
      sessionAction
    } as never);

    await tool.execute("call-1", {
      sessionId: "session-1",
      action: "share_contact",
      contactValue: "tg://demo"
    });

    expect(sessionAction).toHaveBeenCalledWith({
      sessionId: "session-1",
      action: "share_contact",
      contactValue: "tg://demo",
      feedbackRating: undefined,
      reportReason: undefined,
      reportDetail: undefined
    });
  });

  it("routes continue_anonymous through sessionAction", async () => {
    const sessionAction = vi.fn(async () => ({ ok: true, state: "pending" }));
    const tool = buildSessionActionsTool({
      reportSession: vi.fn(),
      sessionAction
    } as never);

    await tool.execute("call-1", {
      sessionId: "s-1",
      action: "continue_anonymous"
    });

    expect(sessionAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "continue_anonymous" })
    );
  });

  it("routes leave_session through sessionAction", async () => {
    const sessionAction = vi.fn(async () => ({ ok: true }));
    const tool = buildSessionActionsTool({
      reportSession: vi.fn(),
      sessionAction
    } as never);

    await tool.execute("call-1", {
      sessionId: "s-1",
      action: "leave_session"
    });

    expect(sessionAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "leave_session" })
    );
  });

  it("passes feedbackRating when provided", async () => {
    const sessionAction = vi.fn(async () => ({ ok: true }));
    const tool = buildSessionActionsTool({
      reportSession: vi.fn(),
      sessionAction
    } as never);

    await tool.execute("call-1", {
      sessionId: "s-1",
      action: "leave_session",
      feedbackRating: 4
    });

    expect(sessionAction).toHaveBeenCalledWith(
      expect.objectContaining({ feedbackRating: 4 })
    );
  });

  it("throws on unsupported action", async () => {
    const tool = buildSessionActionsTool({
      reportSession: vi.fn(),
      sessionAction: vi.fn()
    } as never);

    await expect(
      tool.execute("call-1", {
        sessionId: "s-1",
        action: "invalid_action"
      })
    ).rejects.toThrow("Unsupported");
  });

  it("trims whitespace from optional string params", async () => {
    const reportSession = vi.fn(async () => ({ ok: true }));
    const tool = buildSessionActionsTool({
      reportSession,
      sessionAction: vi.fn()
    } as never);

    await tool.execute("call-1", {
      sessionId: "s-1",
      action: "report_session",
      reportReason: "  spam  ",
      reportDetail: "  lots of ads  "
    });

    expect(reportSession).toHaveBeenCalledWith(
      expect.objectContaining({
        reportReason: "spam",
        reportDetail: "lots of ads"
      })
    );
  });

  it("treats empty-string contactValue as undefined", async () => {
    const sessionAction = vi.fn(async () => ({ ok: true }));
    const tool = buildSessionActionsTool({
      reportSession: vi.fn(),
      sessionAction
    } as never);

    await tool.execute("call-1", {
      sessionId: "s-1",
      action: "share_contact",
      contactValue: "   "
    });

    expect(sessionAction).toHaveBeenCalledWith(
      expect.objectContaining({ contactValue: undefined })
    );
  });
});
