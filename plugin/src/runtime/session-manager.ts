import type {
  MatchIntent,
  RelayEnvelope,
  SessionStatus,
  ShadowSessionSummary
} from "../types/domain.js";

import type { ClawBumpService } from "./service.js";

import { parseControlInput } from "./control-parser.js";
import { buildContactSharePrompt, buildContinuePrompt } from "./disclosure.js";
import { buildShadowIntro } from "./opener.js";

type SessionManagerOptions = {
  service: Pick<
    ClawBumpService,
    | "joinPoolPresence"
    | "listSessions"
    | "relayMessage"
    | "reportSession"
    | "requestCollision"
    | "subscribeToSession"
    | "sessionAction"
  >;
  assistantAddress: string;
  defaultLocale: string;
  defaultAudienceSegment?: string;
};

export class ClawBumpSessionManager {
  private readonly service: SessionManagerOptions["service"];
  private readonly assistantAddress: string;
  private readonly defaultLocale: string;
  private readonly defaultAudienceSegment: string;
  private activeSession: ShadowSessionSummary | null = null;
  private cachedSessions: ShadowSessionSummary[] = [];
  private releasePresence: (() => Promise<void>) | null = null;
  private presenceSegment: string | null = null;
  private releaseSessionSubscription: (() => Promise<void>) | null = null;
  private subscribedSessionId: string | null = null;

  constructor(options: SessionManagerOptions) {
    this.service = options.service;
    this.assistantAddress = options.assistantAddress;
    this.defaultLocale = options.defaultLocale;
    this.defaultAudienceSegment = options.defaultAudienceSegment ?? "ai-tech-startup";
  }

  getActiveSession(): ShadowSessionSummary | null {
    return this.activeSession;
  }

  async requestCollision(intent: MatchIntent): Promise<string> {
    await this.ensurePresence(intent.audienceSegment ?? this.defaultAudienceSegment);

    const result = await this.service.requestCollision({
      audienceSegment: intent.audienceSegment ?? this.defaultAudienceSegment,
      mode: intent.mode ?? (intent.topic || intent.constraint ? "filtered" : "blind"),
      topic: intent.topic,
      constraint: intent.constraint
    });

    if (result.session) {
      this.activeSession = result.session as ShadowSessionSummary;

      return `${buildShadowIntro(result.session.introSummary)}\n${result.session.openerPrompt}`;
    }

    if (result.mode === "deduped") {
      return "你已经在匹配池里了。我先不重复开票，等有影子接上来你再看 inbox。";
    }

    return "我已经把你放进碰撞池了。现在没人即时接上时，会先以异步方式挂着。";
  }

  async syncSessions(statuses: SessionStatus[] = ["live", "contact_shared", "ended"]): Promise<string> {
    const result = await this.service.listSessions(statuses);
    const sessions = (result.sessions ?? []) as ShadowSessionSummary[];
    this.cachedSessions = sessions;

    if (sessions.length === 0) {
      this.activeSession = null;
      return "现在还没有新的影子会话。";
    }

    this.activeSession = selectPreferredSession(sessions, this.activeSession?.sessionId);

    return [
      `找到 ${sessions.length} 个影子会话。`,
      describeSession(this.activeSession),
      sessions
        .map((session, index) => `${index + 1}. ${renderSessionLine(session)}`)
        .join("\n")
    ].join("\n");
  }

  async useSession(sessionId: string): Promise<string> {
    if (this.cachedSessions.length === 0) {
      await this.syncSessions();
    }

    const next = this.cachedSessions.find((session) => session.sessionId === sessionId);
    if (!next) {
      return `没找到会话 ${sessionId}。先用 /bump inbox 刷一次。`;
    }

    this.activeSession = next;
    return describeSession(next);
  }

  async send(text: string): Promise<string> {
    if (!this.activeSession) {
      return "你现在没有激活中的影子会话。先用 /bump inbox 或 /bump find。";
    }

    if (this.activeSession.status !== "live") {
      return `当前会话状态是 ${this.activeSession.status}，不能继续发实时消息。`;
    }

    const parsed = parseControlInput({
      text,
      assistantAddress: this.assistantAddress
    });

    if (parsed.kind === "ambiguous") {
      return "这句话像是在给龙虾下指令。我没有转发。请明确用“龙虾，…”或直接改成你要对影子说的话。";
    }

    if (parsed.kind === "assistant") {
      return "这条像是在跟龙虾说话，我没有转发。高风险动作请用 /bump continue、/bump contact、/bump leave、/bump report。";
    }

    const result = await this.service.relayMessage({
      sessionId: this.activeSession.sessionId,
      body: parsed.body,
      messageType: "peer"
    });
    const relay = result.relay as RelayEnvelope | undefined;

    return relay
      ? `已通过 ${this.activeSession.shadowLabel} 发出：${relay.body}`
      : "消息已交给中继。";
  }

  async continueAnonymous(): Promise<string> {
    const session = this.activeSession;
    if (!session) {
      return "你现在没有激活中的影子会话。";
    }

    const result = await this.service.sessionAction({
      sessionId: session.sessionId,
      action: "continue_anonymous"
    });

    if (result.state === "unlocked") {
      session.eligibleForRematchAt = result.eligibleForRematchAt ?? null;
      return `${buildContinuePrompt()}\n双方都点了想再聊，匿名续聊资格已经保留。`;
    }

    return `${buildContinuePrompt()}\n我先记下你的意愿，等对方也确认。`;
  }

  async shareContact(contactValue: string): Promise<string> {
    const session = this.activeSession;
    if (!session) {
      return "你现在没有激活中的影子会话。";
    }

    const result = await this.service.sessionAction({
      sessionId: session.sessionId,
      action: "share_contact",
      contactValue
    });

    if (result.state === "unlocked") {
      session.status = "contact_shared";
      return [
        buildContactSharePrompt(),
        `双方都确认了。对方的联系方式是：${result.peerContact?.value ?? "未返回"}.`
      ].join("\n");
    }

    return `${buildContactSharePrompt()}\n我先记下你的联系方式，等对方确认。`;
  }

  async leaveSession(): Promise<string> {
    const session = this.activeSession;
    if (!session) {
      return "你现在没有激活中的影子会话。";
    }

    await this.service.sessionAction({
      sessionId: session.sessionId,
      action: "leave_session"
    });
    session.status = "ended";

    return "我已经把这段影子会话结束了。";
  }

  async reportSession(reason: string, detail?: string): Promise<string> {
    const session = this.activeSession;
    if (!session) {
      return "你现在没有激活中的影子会话。";
    }

    await this.service.reportSession({
      sessionId: session.sessionId,
      action: "report_session",
      reportReason: reason,
      reportDetail: detail
    });

    return "我已经记录举报，并默认帮你拉黑这位影子。";
  }

  describeCurrentSession(): string {
    return describeSession(this.activeSession);
  }

  async connectToActiveSession(handlers: {
    onPresenceSync?: (payload: unknown) => void;
    onRelay?: (payload: unknown) => void;
  }): Promise<string> {
    if (!this.activeSession) {
      await this.syncSessions(["live", "contact_shared", "ended"]);
    }

    if (!this.activeSession) {
      return "当前没有可连接的影子会话。";
    }

    if (this.activeSession.status !== "live") {
      return `当前激活会话是 ${this.activeSession.status}，没有实时频道可接。`;
    }

    if (this.subscribedSessionId === this.activeSession.sessionId && this.releaseSessionSubscription) {
      return `已经接到会话 ${this.activeSession.sessionId} 的实时频道。`;
    }

    if (this.releaseSessionSubscription) {
      await this.releaseSessionSubscription();
    }

    this.releaseSessionSubscription = await this.service.subscribeToSession(
      this.activeSession.sessionId,
      handlers
    );
    this.subscribedSessionId = this.activeSession.sessionId;

    return `已接到会话 ${this.activeSession.sessionId} 的实时频道。`;
  }

  async disconnectActiveSession(): Promise<void> {
    if (!this.releaseSessionSubscription) {
      return;
    }

    await this.releaseSessionSubscription();
    this.releaseSessionSubscription = null;
    this.subscribedSessionId = null;
  }

  private async ensurePresence(segment: string) {
    if (this.presenceSegment === segment && this.releasePresence) {
      return;
    }

    if (this.releasePresence) {
      await this.releasePresence();
    }

    this.releasePresence = await this.service.joinPoolPresence(segment, this.defaultLocale);
    this.presenceSegment = segment;
  }
}

function selectPreferredSession(
  sessions: ShadowSessionSummary[],
  currentSessionId?: string
): ShadowSessionSummary {
  const current = currentSessionId
    ? sessions.find((session) => session.sessionId === currentSessionId)
    : undefined;
  if (current) {
    return current;
  }

  return (
    sessions.find((session) => session.status === "live") ??
    sessions.find((session) => session.status === "contact_shared") ??
    sessions[0]
  );
}

function describeSession(session: ShadowSessionSummary | null): string {
  if (!session) {
    return "当前没有激活中的影子会话。";
  }

  return `${buildShadowIntro(session.introSummary)}\n${session.openerPrompt}`;
}

function renderSessionLine(session: ShadowSessionSummary): string {
  return `${session.sessionId} [${session.status}] ${session.shadowLabel}${session.peerShadowLabel ? ` vs ${session.peerShadowLabel}` : ""}`;
}
