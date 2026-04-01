import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { readEnv } from "../_shared/env.ts";
import { json, parseJson } from "../_shared/http.ts";
import { assertRateLimit } from "../_shared/rate-limit.ts";

type ReportPayload = {
  sessionId: string;
  reportReason?: string;
  reportDetail?: string;
};

Deno.serve(async (req) => {
  try {
    const env = readEnv();
    const userId = await requireUserId(req, env);
    assertRateLimit(`report-session:${userId}`);
    const payload = await parseJson<ReportPayload>(req);
    const admin = createAdminClient(env);

    const { data: members, error: memberError } = await admin
      .from("shadow_session_members")
      .select("id,profile_id")
      .eq("session_id", payload.sessionId);

    if (memberError || !members || members.length < 2) {
      throw new Error(memberError?.message ?? "Expected a two-party shadow session.");
    }

    const reporter = members.find((member) => member.profile_id === userId);
    const reported = members.find((member) => member.profile_id !== userId);
    if (!reporter || !reported) {
      throw new Error("Reporter membership mismatch.");
    }

    await admin.from("session_reports").insert({
      session_id: payload.sessionId,
      reporter_member_id: reporter.id,
      reported_member_id: reported.id,
      reason: payload.reportReason ?? "unspecified",
      detail: payload.reportDetail ?? null
    });

    await admin.from("blocks").upsert(
      {
        blocker_profile_id: userId,
        blocked_profile_id: reported.profile_id,
        source_session_id: payload.sessionId
      },
      {
        onConflict: "blocker_profile_id,blocked_profile_id"
      }
    );

    return json({
      ok: true,
      blockedProfileId: reported.profile_id
    });
  } catch (error) {
    return json({ ok: false, error: toMessage(error) }, 400);
  }
});

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

