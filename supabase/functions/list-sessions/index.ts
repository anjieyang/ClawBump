import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { readEnv } from "../_shared/env.ts";
import { json, parseJson } from "../_shared/http.ts";
import { assertRateLimit } from "../_shared/rate-limit.ts";

type ListSessionsPayload = {
  statuses?: Array<"live" | "contact_shared" | "ended">;
  limit?: number;
};

type SessionRow = {
  id: string;
  intro_summary: string;
  opener_prompt: string;
  status: "live" | "contact_shared" | "ended";
  started_at: string;
  ended_at: string | null;
  eligible_for_rematch_at: string | null;
};

type SessionMemberRow = {
  session_id: string;
  profile_id: string;
  shadow_label: string;
};

type ProfileRow = {
  id: string;
  display_locale: string;
};

Deno.serve(async (req) => {
  try {
    const env = readEnv();
    const userId = await requireUserId(req, env);
    assertRateLimit(`list-sessions:${userId}`);
    const payload = await parseJson<ListSessionsPayload>(req).catch(() => ({}));
    const admin = createAdminClient(env);
    const statuses = normalizeStatuses(payload.statuses);
    const limit = normalizeLimit(payload.limit);

    const { data: memberships, error: membershipError } = await admin
      .from("shadow_session_members")
      .select("session_id,profile_id,shadow_label")
      .eq("profile_id", userId);

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    if (!memberships || memberships.length === 0) {
      return json({
        ok: true,
        sessions: []
      });
    }

    const sessionIds = Array.from(new Set(memberships.map((row) => row.session_id)));
    const { data: sessions, error: sessionError } = await admin
      .from("shadow_sessions")
      .select("id,intro_summary,opener_prompt,status,started_at,ended_at,eligible_for_rematch_at")
      .in("id", sessionIds)
      .in("status", statuses)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const filteredSessions = (sessions ?? []) as SessionRow[];
    if (filteredSessions.length === 0) {
      return json({
        ok: true,
        sessions: []
      });
    }

    const filteredSessionIds = filteredSessions.map((row) => row.id);
    const [{ data: allMembers, error: allMembersError }, { data: peerProfiles, error: profileError }] =
      await Promise.all([
        admin
          .from("shadow_session_members")
          .select("session_id,profile_id,shadow_label")
          .in("session_id", filteredSessionIds),
        admin.from("profiles").select("id,display_locale")
      ]);

    if (allMembersError) {
      throw new Error(allMembersError.message);
    }

    if (profileError) {
      throw new Error(profileError.message);
    }

    const ownMembershipMap = new Map<string, SessionMemberRow>(
      (memberships as SessionMemberRow[]).map((row) => [row.session_id, row])
    );
    const peerLocaleMap = new Map<string, string>(
      ((peerProfiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile.display_locale])
    );
    const membersBySession = groupMembersBySession((allMembers ?? []) as SessionMemberRow[]);

    return json({
      ok: true,
      sessions: filteredSessions
        .map((session) => {
          const ownMembership = ownMembershipMap.get(session.id);
          if (!ownMembership) {
            return null;
          }

          const peerMember = (membersBySession.get(session.id) ?? []).find(
            (member) => member.profile_id !== userId
          );

          return {
            sessionId: session.id,
            shadowLabel: ownMembership.shadow_label,
            peerShadowLabel: peerMember?.shadow_label ?? null,
            introSummary: session.intro_summary,
            openerPrompt: session.opener_prompt,
            peerLocale: peerMember ? peerLocaleMap.get(peerMember.profile_id) : null,
            status: session.status,
            startedAt: session.started_at,
            endedAt: session.ended_at,
            eligibleForRematchAt: session.eligible_for_rematch_at
          };
        })
        .filter((session): session is NonNullable<typeof session> => session !== null)
    });
  } catch (error) {
    return json({ ok: false, error: toMessage(error) }, 400);
  }
});

function groupMembersBySession(rows: SessionMemberRow[]) {
  const grouped = new Map<string, SessionMemberRow[]>();

  for (const row of rows) {
    const existing = grouped.get(row.session_id) ?? [];
    existing.push(row);
    grouped.set(row.session_id, existing);
  }

  return grouped;
}

function normalizeStatuses(statuses?: string[]): Array<"live" | "contact_shared" | "ended"> {
  const allowed = new Set(["live", "contact_shared", "ended"]);
  const filtered = (statuses ?? []).filter(
    (status): status is "live" | "contact_shared" | "ended" => allowed.has(status)
  );

  return filtered.length > 0 ? filtered : ["live", "contact_shared", "ended"];
}

function normalizeLimit(limit?: number): number {
  if (!Number.isInteger(limit) || !limit) {
    return 10;
  }

  return Math.max(1, Math.min(limit, 25));
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
