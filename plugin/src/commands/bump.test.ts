import { describe, expect, it, vi } from "vitest";

import { buildBumpCommand } from "./bump.js";

function buildRuntime(overrides = {}) {
  return {
    continueAnonymous: vi.fn(async () => "continued"),
    describeCurrentSession: vi.fn(() => "当前没有激活中的影子会话。"),
    leaveSession: vi.fn(async () => "left"),
    reportSession: vi.fn(async () => "reported"),
    requestCollision: vi.fn(async () => "requested"),
    send: vi.fn(async () => "sent"),
    shareContact: vi.fn(async () => "shared"),
    syncSessions: vi.fn(async () => "inbox"),
    useSession: vi.fn(async () => "switched"),
    ...overrides
  } as never;
}

describe("buildBumpCommand", () => {
  // --- empty / help ---

  it("shows help text when args is empty", async () => {
    const command = buildBumpCommand(buildRuntime());
    const result = await command.handler("");

    expect(result).toContain("ClawBump 已安装");
    expect(result).toContain("find");
    expect(result).toContain("inbox");
  });

  it("shows help text when args is undefined", async () => {
    const command = buildBumpCommand(buildRuntime());
    const result = await command.handler(undefined as never);

    expect(result).toContain("ClawBump 已安装");
  });

  it("shows help text when args is whitespace-only", async () => {
    const command = buildBumpCommand(buildRuntime());
    const result = await command.handler("   ");

    expect(result).toContain("ClawBump 已安装");
  });

  // --- find ---

  it("calls requestCollision with blind mode when no topic", async () => {
    const requestCollision = vi.fn(async () => "requested blind");
    const command = buildBumpCommand(buildRuntime({ requestCollision }));

    const result = await command.handler("find");

    expect(result).toBe("requested blind");
    expect(requestCollision).toHaveBeenCalledWith({
      topic: undefined,
      mode: "blind"
    });
  });

  it("calls requestCollision with filtered mode and topic", async () => {
    const requestCollision = vi.fn(async () => "requested filtered");
    const command = buildBumpCommand(buildRuntime({ requestCollision }));

    const result = await command.handler("find AI agents");

    expect(result).toBe("requested filtered");
    expect(requestCollision).toHaveBeenCalledWith({
      topic: "AI agents",
      mode: "filtered"
    });
  });

  // --- inbox / status ---

  it("shows inbox for inbox command", async () => {
    const command = buildBumpCommand(buildRuntime());
    await expect(command.handler("inbox")).resolves.toBe("inbox");
  });

  it("shows inbox for status command (alias)", async () => {
    const command = buildBumpCommand(buildRuntime());
    await expect(command.handler("status")).resolves.toBe("inbox");
  });

  // --- use ---

  it("switches session with use command", async () => {
    const useSession = vi.fn(async () => "switched to s-1");
    const command = buildBumpCommand(buildRuntime({ useSession }));

    const result = await command.handler("use s-1");

    expect(result).toBe("switched to s-1");
    expect(useSession).toHaveBeenCalledWith("s-1");
  });

  it("returns error when use command has no sessionId", async () => {
    const command = buildBumpCommand(buildRuntime());
    const result = await command.handler("use");

    expect(result).toContain("sessionId");
  });

  // --- continue ---

  it("calls continueAnonymous for continue command", async () => {
    const continueAnonymous = vi.fn(async () => "will continue");
    const command = buildBumpCommand(buildRuntime({ continueAnonymous }));

    await expect(command.handler("continue")).resolves.toBe("will continue");
    expect(continueAnonymous).toHaveBeenCalled();
  });

  // --- contact ---

  it("calls shareContact with value", async () => {
    const shareContact = vi.fn(async () => "contact shared");
    const command = buildBumpCommand(buildRuntime({ shareContact }));

    const result = await command.handler("contact tg://myname");

    expect(result).toBe("contact shared");
    expect(shareContact).toHaveBeenCalledWith("tg://myname");
  });

  it("returns error when contact has no value", async () => {
    const command = buildBumpCommand(buildRuntime());
    const result = await command.handler("contact");

    expect(result).toContain("联系方式");
  });

  // --- leave ---

  it("calls leaveSession for leave command", async () => {
    const leaveSession = vi.fn(async () => "left session");
    const command = buildBumpCommand(buildRuntime({ leaveSession }));

    await expect(command.handler("leave")).resolves.toBe("left session");
    expect(leaveSession).toHaveBeenCalled();
  });

  // --- report ---

  it("calls reportSession with reason", async () => {
    const reportSession = vi.fn(async () => "reported");
    const command = buildBumpCommand(buildRuntime({ reportSession }));

    const result = await command.handler("report spam");

    expect(result).toBe("reported");
    expect(reportSession).toHaveBeenCalledWith("spam", undefined);
  });

  it("calls reportSession with reason and detail", async () => {
    const reportSession = vi.fn(async () => "reported");
    const command = buildBumpCommand(buildRuntime({ reportSession }));

    const result = await command.handler("report abuse sent inappropriate content");

    expect(result).toBe("reported");
    expect(reportSession).toHaveBeenCalledWith("abuse", "sent inappropriate content");
  });

  it("returns error when report has no reason", async () => {
    const command = buildBumpCommand(buildRuntime());
    const result = await command.handler("report");

    expect(result).toContain("举报原因");
  });

  // --- send ---

  it("explicitly sends with send command", async () => {
    const send = vi.fn(async () => "sent explicit");
    const command = buildBumpCommand(buildRuntime({ send }));

    const result = await command.handler("send 你好呀");

    expect(result).toBe("sent explicit");
    expect(send).toHaveBeenCalledWith("你好呀");
  });

  it("returns error when send has no content", async () => {
    const command = buildBumpCommand(buildRuntime());
    const result = await command.handler("send");

    expect(result).toContain("内容");
  });

  // --- default (bare text) ---

  it("treats unknown input as a send action", async () => {
    const send = vi.fn(async () => "sent bare");
    const command = buildBumpCommand(buildRuntime({ send }));

    await expect(command.handler("你好")).resolves.toBe("sent bare");
    expect(send).toHaveBeenCalledWith("你好");
  });

  it("treats multi-word unknown input as send", async () => {
    const send = vi.fn(async () => "sent multi");
    const command = buildBumpCommand(buildRuntime({ send }));

    await expect(command.handler("我觉得 AI 很有意思")).resolves.toBe("sent multi");
    expect(send).toHaveBeenCalledWith("我觉得 AI 很有意思");
  });
});
