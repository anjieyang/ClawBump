export type CollisionFacet = {
  key: string;
  value: string;
  weight?: number;
};

export type MatchIntent = {
  topic?: string;
  constraint?: string;
  audienceSegment?: string;
  mode?: "blind" | "filtered";
};

export type ShadowSessionSummary = {
  sessionId: string;
  shadowLabel: string;
  introSummary: string;
  openerPrompt: string;
  peerShadowLabel?: string | null;
  peerLocale?: string | null;
  status?: SessionStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  eligibleForRematchAt?: string | null;
};

export type SessionStatus = "live" | "contact_shared" | "ended";

export type SessionActionKind =
  | "continue_anonymous"
  | "share_contact"
  | "leave_session"
  | "report_session";

export type SessionActionPayload = {
  sessionId: string;
  action: SessionActionKind;
  contactValue?: string;
  feedbackRating?: number;
  reportReason?: string;
  reportDetail?: string;
};

export type ToolResultText = {
  text: string;
};

export type RelayPayload = {
  sessionId: string;
  body: string;
  messageType?: "peer" | "assistant_note";
};

export type RelayEnvelope = {
  sessionId: string;
  senderMemberId: string;
  senderShadowLabel: string;
  messageType: "peer" | "assistant_note";
  body: string;
  deliveredAt: string;
};
