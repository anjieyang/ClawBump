import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { readEnv } from "../_shared/env.ts";
import { json, parseJson } from "../_shared/http.ts";
import { assertRateLimit } from "../_shared/rate-limit.ts";

type SessionActionPayload = {
  sessionId: string;
  action: "continue_anonymous" | "share_contact" | "leave_session";
  contactValue?: string;
  feedbackRating?: number;
};

type ConsentState = "locked" | "pending" | "unlocked";

export function resolveConsentState(
  states: Array<"accepted" | "declined" | "pending">,
  requiredAcceptances = 2
): ConsentState {
  if (states.length === 0) {
    return "locked";
  }
  if (states.some((state) => state === "declined")) {
    return "locked";
  }

  const acceptedCount = states.filter((state) => state === "accepted").length;
  if (acceptedCount >= requiredAcceptances) {
    return "unlocked";
  }

  return acceptedCount > 0 || states.some((state) => state === "pending") ? "pending" : "locked";
}

Deno.serve(async (req) => {
  try {
    const env = readEnv();
    const userId = await requireUserId(req, env);
    assertRateLimit(`session-action:${userId}`);
    const payload = await parseJson<SessionActionPayload>(req);
    const admin = createAdminClient(env);
    const now = new Date().toISOString();

    const [{ data: session, error: sessionError }, { data: members, error: memberError }] = await Promise.all([
      admin.from("shadow_sessions").select("id,status,eligible_for_rematch_at").eq("id", payload.sessionId).single(),
      admin
        .from("shadow_session_members")
        .select("id,profile_id,shadow_label,left_at")
        .eq("session_id", payload.sessionId)
    ]);

    if (sessionError || !session) {
      throw new Error(sessionError?.message ?? "Shadow session not found.");
    }

    if (memberError || !members || members.length === 0) {
      throw new Error(memberError?.message ?? "Session membership not found.");
    }

    const member = members.find((entry) => entry.profile_id === userId);
    if (!member) {
      throw new Error("Session membership not found.");
    }

    if (typeof payload.feedbackRating === "number") {
      await upsertFeedback(admin, payload.sessionId, member.id, payload.feedbackRating);
    }

    if (payload.action === "leave_session") {
      const { error: leaveError } = await admin
        .from("shadow_session_members")
        .update({
          left_at: now
        })
        .eq("id", member.id);

      if (leaveError) {
        throw new Error(leaveError.message);
      }

      const { error: sessionUpdateError } = await admin
        .from("shadow_sessions")
        .update({
          status: "ended",
          ended_at: now
        })
        .eq("id", payload.sessionId)
        .in("status", ["live", "contact_shared"]);

      if (sessionUpdateError) {
        throw new Error(sessionUpdateError.message);
      }

      return json({
        ok: true,
        action: payload.action,
        sessionStatus: "ended"
      });
    }

    if (payload.action === "share_contact" && !hasText(payload.contactValue)) {
      throw new Error("Contact value is required for share_contact.");
    }

    const { error } = await admin.from("session_consents").upsert(
      {
        session_id: payload.sessionId,
        member_id: member.id,
        consent_kind: payload.action,
        state: "accepted",
        contact_payload: payload.action === "share_contact" ? { value: payload.contactValue?.trim() } : null,
        updated_at: now
      },
      {
        onConflict: "session_id,member_id,consent_kind"
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    const { data: consentRows, error: consentError } = await admin
      .from("session_consents")
      .select("member_id,state,contact_payload")
      .eq("session_id", payload.sessionId)
      .eq("consent_kind", payload.action);

    if (consentError || !consentRows) {
      throw new Error(consentError?.message ?? "Failed to load session consent state.");
    }

    const state = resolveConsentState(consentRows.map((row) => row.state), members.length);
    if (payload.action === "continue_anonymous" && state === "unlocked") {
      const { error: sessionUpdateError } = await admin
        .from("shadow_sessions")
        .update({
          eligible_for_rematch_at: now
        })
        .eq("id", payload.sessionId);

      if (sessionUpdateError) {
        throw new Error(sessionUpdateError.message);
      }
    }

    if (payload.action === "share_contact" && state === "unlocked") {
      const { error: sessionUpdateError } = await admin
        .from("shadow_sessions")
        .update({
          status: "contact_shared"
        })
        .eq("id", payload.sessionId);

      if (sessionUpdateError) {
        throw new Error(sessionUpdateError.message);
      }
    }

    const peerMember = members.find((entry) => entry.id !== member.id);
    const peerConsent = consentRows.find((row) => row.member_id !== member.id);

    return json({
      ok: true,
      action: payload.action,
      state,
      sessionStatus:
        payload.action === "share_contact" && state === "unlocked" ? "contact_shared" : session.status,
      eligibleForRematchAt:
        payload.action === "continue_anonymous" && state === "unlocked"
          ? now
          : session.eligible_for_rematch_at,
      peerContact:
        payload.action === "share_contact" && state === "unlocked" && peerMember && peerConsent
          ? {
              shadowLabel: peerMember.shadow_label,
              value: extractContactValue(peerConsent.contact_payload)
            }
          : null
    });
  } catch (error) {
    return json({ ok: false, error: toMessage(error) }, 400);
  }
});

async function upsertFeedback(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string,
  memberId: string,
  rating: number
) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Feedback rating must be an integer between 1 and 5.");
  }

  const { error } = await admin.from("session_feedback").upsert(
    {
      session_id: sessionId,
      member_id: memberId,
      rating
    },
    {
      onConflict: "session_id,member_id"
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

function hasText(value?: string): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function extractContactValue(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = (payload as { value?: unknown }).value;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
