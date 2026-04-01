import { describe, expect, it, vi } from "vitest";

import type { ShadowSessionSummary } from "../types/domain.js";

import { ClawBumpSessionManager } from "./session-manager.js";

function buildSession(overrides: Partial<ShadowSessionSummary> = {}): ShadowSessionSummary {
  return {
    sessionId: "session-1",
    shadowLabel: "Shadow A",
    introSummary: "一个喜欢聊 agent 边界的影子。",
    openerPrompt: "先从你们为什么都盯着 agent 说起。",
    status: "live",
    ...overrides
  };
}

function buildService(overrides = {}) {
  return {
    async joinPoolPresence() {
      return async () => {};
    },
    async listSessions() {
      return { sessions: [] };
    },
    async relayMessage() {
      return { relay: { body: "test", senderShadowLabel: "Shadow A" } };
    },
    async reportSession() {
      return { ok: true };
    },
    async requestCollision() {
      return { mode: "live", session: buildSession() };
    },
    async subscribeToSession() {
      return async () => {};
    },
    async sessionAction() {
      return { state: "pending" };
    },
    ...overrides
  };
}

function buildManager(serviceOverrides = {}) {
  return new ClawBumpSessionManager({
    assistantAddress: "龙虾",
    defaultLocale: "zh-CN",
    service: buildService(serviceOverrides)
  });
}

describe("ClawBumpSessionManager", () => {
  // --- requestCollision ---

  it("stores a live session when a match resolves immediately", async () => {
    const manager = buildManager();

    const text = await manager.requestCollision({ topic: "AI agents" });

    expect(text).toContain("新影子");
    expect(manager.getActiveSession()?.sessionId).toBe("session-1");
  });

  it("returns deferred message when no immediate match", async () => {
    const manager = buildManager({
      async requestCollision() {
        return { mode: "deferred", requestId: "req-1" };
      }
    });

    const text = await manager.requestCollision({ topic: "AI agents" });

    expect(text).toContain("碰撞池");
    expect(manager.getActiveSession()).toBeNull();
  });

  it("returns deduped message when already in pool", async () => {
    const manager = buildManager({
      async requestCollision() {
        return { mode: "deduped", requestId: "req-1" };
      }
    });

    const text = await manager.requestCollision({ topic: "AI agents" });

    expect(text).toContain("已经在匹配池");
    expect(manager.getActiveSession()).toBeNull();
  });

  it("joins pool presence before requesting collision", async () => {
    const joinPoolPresence = vi.fn(async () => async () => {});
    const manager = buildManager({ joinPoolPresence });

    await manager.requestCollision({ topic: "test" });

    expect(joinPoolPresence).toHaveBeenCalledWith("ai-tech-startup", "zh-CN");
  });

  it("uses custom audience segment for presence", async () => {
    const joinPoolPresence = vi.fn(async () => async () => {});
    const manager = buildManager({ joinPoolPresence });

    await manager.requestCollision({
      topic: "test",
      audienceSegment: "fintech"
    });

    expect(joinPoolPresence).toHaveBeenCalledWith("fintech", "zh-CN");
  });

  it("does not rejoin presence for the same segment", async () => {
    const joinPoolPresence = vi.fn(async () => async () => {});
    const manager = buildManager({ joinPoolPresence });

    await manager.requestCollision({ topic: "first" });
    await manager.requestCollision({ topic: "second" });

    expect(joinPoolPresence).toHaveBeenCalledTimes(1);
  });

  it("rejoins presence when segment changes", async () => {
    const joinPoolPresence = vi.fn(async () => async () => {});
    const manager = buildManager({ joinPoolPresence });

    await manager.requestCollision({ topic: "first", audienceSegment: "a" });
    await manager.requestCollision({ topic: "second", audienceSegment: "b" });

    expect(joinPoolPresence).toHaveBeenCalledTimes(2);
  });

  // --- send ---

  it("relays ordinary peer text through the active session", async () => {
    const relayMessage = vi.fn(async () => ({
      relay: { body: "你好", senderShadowLabel: "Shadow A" }
    }));
    const manager = buildManager({ relayMessage });

    await manager.requestCollision({ topic: "AI agents" });
    const text = await manager.send("你好");

    expect(relayMessage).toHaveBeenCalledWith({
      sessionId: "session-1",
      body: "你好",
      messageType: "peer"
    });
    expect(text).toContain("已通过 Shadow A 发出");
  });

  it("returns fallback message when relay returns no envelope", async () => {
    const manager = buildManager({
      async relayMessage() {
        return { ok: true };
      }
    });

    await manager.requestCollision({ topic: "test" });
    const text = await manager.send("你好");

    expect(text).toContain("消息已交给中继");
  });

  it("does not relay ambiguous control-like text", async () => {
    const relayMessage = vi.fn();
    const manager = buildManager({ relayMessage });

    await manager.requestCollision({ topic: "AI agents" });
    const text = await manager.send("帮我委婉一点问");

    expect(relayMessage).not.toHaveBeenCalled();
    expect(text).toContain("没有转发");
  });

  it("does not relay explicitly addressed assistant text", async () => {
    const relayMessage = vi.fn();
    const manager = buildManager({ relayMessage });

    await manager.requestCollision({ topic: "AI agents" });
    const text = await manager.send("龙虾，翻译一下");

    expect(relayMessage).not.toHaveBeenCalled();
    expect(text).toContain("在跟龙虾说话");
  });

  it("does not relay slash commands", async () => {
    const relayMessage = vi.fn();
    const manager = buildManager({ relayMessage });

    await manager.requestCollision({ topic: "test" });
    const text = await manager.send("/bump leave");

    expect(relayMessage).not.toHaveBeenCalled();
    expect(text).toContain("在跟龙虾说话");
  });

  it("returns error when sending without an active session", async () => {
    const manager = buildManager();

    const text = await manager.send("hello");

    expect(text).toContain("没有激活中的影子会话");
  });

  it("returns error when sending in a non-live session", async () => {
    const manager = buildManager({
      async requestCollision() {
        return { mode: "live", session: buildSession({ status: "ended" }) };
      }
    });

    await manager.requestCollision({ topic: "test" });
    const text = await manager.send("hello");

    expect(text).toContain("ended");
    expect(text).toContain("不能继续发");
  });

  it("blocks send on contact_shared status", async () => {
    const manager = buildManager({
      async requestCollision() {
        return { mode: "live", session: buildSession({ status: "contact_shared" }) };
      }
    });

    await manager.requestCollision({ topic: "test" });
    const text = await manager.send("hello");

    expect(text).toContain("contact_shared");
  });

  // --- syncSessions ---

  it("syncs sessions and picks the live one by default", async () => {
    const manager = buildManager({
      async listSessions() {
        return {
          sessions: [
            buildSession({ sessionId: "ended-1", status: "ended" }),
            buildSession({ sessionId: "live-1", status: "live" })
          ]
        };
      }
    });

    const text = await manager.syncSessions();

    expect(text).toContain("找到 2 个影子会话");
    expect(manager.getActiveSession()?.sessionId).toBe("live-1");
  });

  it("returns empty message when no sessions exist", async () => {
    const manager = buildManager();

    const text = await manager.syncSessions();

    expect(text).toContain("还没有");
    expect(manager.getActiveSession()).toBeNull();
  });

  it("prefers contact_shared over ended when no live session", async () => {
    const manager = buildManager({
      async listSessions() {
        return {
          sessions: [
            buildSession({ sessionId: "ended-1", status: "ended" }),
            buildSession({ sessionId: "cs-1", status: "contact_shared" })
          ]
        };
      }
    });

    await manager.syncSessions();

    expect(manager.getActiveSession()?.sessionId).toBe("cs-1");
  });

  it("preserves current active session if still in list", async () => {
    const manager = buildManager({
      async requestCollision() {
        return { mode: "live", session: buildSession({ sessionId: "s-old" }) };
      },
      async listSessions() {
        return {
          sessions: [
            buildSession({ sessionId: "s-new", status: "live" }),
            buildSession({ sessionId: "s-old", status: "live" })
          ]
        };
      }
    });

    await manager.requestCollision({ topic: "test" });
    expect(manager.getActiveSession()?.sessionId).toBe("s-old");

    await manager.syncSessions();

    // s-old is preserved even though s-new exists
    expect(manager.getActiveSession()?.sessionId).toBe("s-old");
  });

  it("clears active session when sync returns empty", async () => {
    const manager = buildManager();

    await manager.requestCollision({ topic: "test" });
    expect(manager.getActiveSession()).not.toBeNull();

    // Override to return empty
    const emptyManager = buildManager({
      async requestCollision() {
        return { mode: "live", session: buildSession() };
      },
      async listSessions() {
        return { sessions: [] };
      }
    });
    await emptyManager.requestCollision({ topic: "test" });
    await emptyManager.syncSessions();

    expect(emptyManager.getActiveSession()).toBeNull();
  });

  // --- useSession ---

  it("switches to a cached session by id", async () => {
    const manager = buildManager({
      async listSessions() {
        return {
          sessions: [
            buildSession({ sessionId: "s-1", status: "live" }),
            buildSession({ sessionId: "s-2", status: "live", shadowLabel: "Shadow B" })
          ]
        };
      }
    });

    await manager.syncSessions();
    const text = await manager.useSession("s-2");

    expect(manager.getActiveSession()?.sessionId).toBe("s-2");
    expect(text).toContain("新影子");
  });

  it("returns error when session id not found", async () => {
    const manager = buildManager({
      async listSessions() {
        return { sessions: [buildSession({ sessionId: "s-1" })] };
      }
    });

    await manager.syncSessions();
    const text = await manager.useSession("nonexistent");

    expect(text).toContain("没找到");
  });

  it("auto-syncs when cached sessions are empty", async () => {
    const listSessions = vi.fn(async () => ({
      sessions: [buildSession({ sessionId: "s-1" })]
    }));
    const manager = buildManager({ listSessions });

    // No prior sync, should auto-sync
    await manager.useSession("s-1");

    expect(listSessions).toHaveBeenCalled();
    expect(manager.getActiveSession()?.sessionId).toBe("s-1");
  });

  // --- continueAnonymous ---

  it("returns unlocked message when both parties agreed", async () => {
    const manager = buildManager({
      async sessionAction() {
        return { state: "unlocked", eligibleForRematchAt: "2026-01-01T00:00:00Z" };
      }
    });

    await manager.requestCollision({ topic: "test" });
    const text = await manager.continueAnonymous();

    expect(text).toContain("双方都点了");
    expect(manager.getActiveSession()?.eligibleForRematchAt).toBe("2026-01-01T00:00:00Z");
  });

  it("returns pending message when waiting for peer", async () => {
    const manager = buildManager({
      async sessionAction() {
        return { state: "pending" };
      }
    });

    await manager.requestCollision({ topic: "test" });
    const text = await manager.continueAnonymous();

    expect(text).toContain("等对方");
  });

  it("returns error when no active session", async () => {
    const manager = buildManager();

    const text = await manager.continueAnonymous();

    expect(text).toContain("没有激活中的影子会话");
  });

  // --- shareContact ---

  it("returns unlocked message with peer contact", async () => {
    const manager = buildManager({
      async sessionAction() {
        return {
          state: "unlocked",
          peerContact: { value: "tg://peer" }
        };
      }
    });

    await manager.requestCollision({ topic: "test" });
    const text = await manager.shareContact("tg://me");

    expect(text).toContain("双方都确认");
    expect(text).toContain("tg://peer");
    expect(manager.getActiveSession()?.status).toBe("contact_shared");
  });

  it("returns pending message when peer has not confirmed", async () => {
    const manager = buildManager();

    await manager.requestCollision({ topic: "test" });
    const text = await manager.shareContact("tg://me");

    expect(text).toContain("等对方");
  });

  it("shows fallback when peerContact is null", async () => {
    const manager = buildManager({
      async sessionAction() {
        return { state: "unlocked", peerContact: null };
      }
    });

    await manager.requestCollision({ topic: "test" });
    const text = await manager.shareContact("tg://me");

    expect(text).toContain("未返回");
  });

  it("returns error when no active session", async () => {
    const manager = buildManager();

    const text = await manager.shareContact("tg://me");

    expect(text).toContain("没有激活中的影子会话");
  });

  // --- leaveSession ---

  it("ends the active session", async () => {
    const sessionAction = vi.fn(async () => ({ ok: true }));
    const manager = buildManager({ sessionAction });

    await manager.requestCollision({ topic: "test" });
    const text = await manager.leaveSession();

    expect(text).toContain("结束");
    expect(sessionAction).toHaveBeenCalledWith({
      sessionId: "session-1",
      action: "leave_session"
    });
    expect(manager.getActiveSession()?.status).toBe("ended");
  });

  it("returns error when no active session", async () => {
    const manager = buildManager();

    const text = await manager.leaveSession();

    expect(text).toContain("没有激活中的影子会话");
  });

  // --- reportSession ---

  it("reports and blocks the peer", async () => {
    const reportSession = vi.fn(async () => ({ ok: true }));
    const manager = buildManager({ reportSession });

    await manager.requestCollision({ topic: "test" });
    const text = await manager.reportSession("spam", "keeps sending ads");

    expect(text).toContain("举报");
    expect(text).toContain("拉黑");
    expect(reportSession).toHaveBeenCalledWith({
      sessionId: "session-1",
      action: "report_session",
      reportReason: "spam",
      reportDetail: "keeps sending ads"
    });
  });

  it("reports without detail", async () => {
    const reportSession = vi.fn(async () => ({ ok: true }));
    const manager = buildManager({ reportSession });

    await manager.requestCollision({ topic: "test" });
    await manager.reportSession("abuse");

    expect(reportSession).toHaveBeenCalledWith({
      sessionId: "session-1",
      action: "report_session",
      reportReason: "abuse",
      reportDetail: undefined
    });
  });

  it("returns error when no active session", async () => {
    const manager = buildManager();

    const text = await manager.reportSession("spam");

    expect(text).toContain("没有激活中的影子会话");
  });

  // --- describeCurrentSession ---

  it("describes the active session", async () => {
    const manager = buildManager();

    await manager.requestCollision({ topic: "test" });
    const text = manager.describeCurrentSession();

    expect(text).toContain("新影子");
  });

  it("returns empty message when no session", () => {
    const manager = buildManager();

    const text = manager.describeCurrentSession();

    expect(text).toContain("没有激活中的影子会话");
  });

  // --- connectToActiveSession ---

  it("connects the active live session to a realtime subscription", async () => {
    const subscribeToSession = vi.fn(async () => async () => {});
    const manager = buildManager({
      subscribeToSession,
      async listSessions() {
        return { sessions: [buildSession({ sessionId: "live-1", status: "live" })] };
      }
    });

    const text = await manager.connectToActiveSession({ onRelay: vi.fn() });

    expect(text).toContain("已接到会话 live-1 的实时频道");
    expect(subscribeToSession).toHaveBeenCalledWith("live-1", { onRelay: expect.any(Function) });
  });

  it("returns already-connected message for the same session", async () => {
    const subscribeToSession = vi.fn(async () => async () => {});
    const manager = buildManager({
      subscribeToSession,
      async listSessions() {
        return { sessions: [buildSession({ sessionId: "live-1", status: "live" })] };
      }
    });

    await manager.connectToActiveSession({ onRelay: vi.fn() });
    const text = await manager.connectToActiveSession({ onRelay: vi.fn() });

    expect(text).toContain("已经接到会话");
    expect(subscribeToSession).toHaveBeenCalledTimes(1);
  });

  it("returns error when no sessions available", async () => {
    const manager = buildManager();

    const text = await manager.connectToActiveSession({});

    expect(text).toContain("没有可连接的影子会话");
  });

  it("returns error when active session is not live", async () => {
    const manager = buildManager({
      async requestCollision() {
        return { mode: "live", session: buildSession({ status: "ended" }) };
      }
    });

    await manager.requestCollision({ topic: "test" });
    const text = await manager.connectToActiveSession({});

    expect(text).toContain("ended");
    expect(text).toContain("没有实时频道可接");
  });

  it("releases previous subscription when connecting to a new session", async () => {
    const release1 = vi.fn(async () => {});
    const release2 = vi.fn(async () => {});
    let callCount = 0;
    const subscribeToSession = vi.fn(async () => {
      callCount += 1;
      return callCount === 1 ? release1 : release2;
    });
    const manager = buildManager({
      subscribeToSession,
      async listSessions() {
        return {
          sessions: [
            buildSession({ sessionId: "s-1", status: "live" }),
            buildSession({ sessionId: "s-2", status: "live" })
          ]
        };
      }
    });

    await manager.syncSessions();
    await manager.connectToActiveSession({ onRelay: vi.fn() });

    await manager.useSession("s-2");
    await manager.connectToActiveSession({ onRelay: vi.fn() });

    expect(release1).toHaveBeenCalled();
    expect(subscribeToSession).toHaveBeenCalledTimes(2);
  });

  // --- disconnectActiveSession ---

  it("disconnects and clears subscription", async () => {
    const release = vi.fn(async () => {});
    const manager = buildManager({
      async subscribeToSession() {
        return release;
      },
      async listSessions() {
        return { sessions: [buildSession({ sessionId: "live-1", status: "live" })] };
      }
    });

    await manager.connectToActiveSession({ onRelay: vi.fn() });
    await manager.disconnectActiveSession();

    expect(release).toHaveBeenCalled();
  });

  it("is a no-op when no subscription exists", async () => {
    const manager = buildManager();

    // Should not throw
    await manager.disconnectActiveSession();
  });
});
