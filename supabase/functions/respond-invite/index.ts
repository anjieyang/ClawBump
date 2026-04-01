import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { readEnv } from "../_shared/env.ts";
import { json, parseJson } from "../_shared/http.ts";
import { assertRateLimit } from "../_shared/rate-limit.ts";

type RespondInvitePayload = {
  inviteId: string;
  decision: "accept" | "decline";
};

Deno.serve(async (req) => {
  try {
    const env = readEnv();
    const userId = await requireUserId(req, env);
    assertRateLimit(`respond-invite:${userId}`);
    const payload = await parseJson<RespondInvitePayload>(req);
    const admin = createAdminClient(env);

    const nextStatus = payload.decision === "accept" ? "accepted" : "declined";
    const { error } = await admin
      .from("match_invites")
      .update({
        status: nextStatus,
        responded_at: new Date().toISOString()
      })
      .eq("id", payload.inviteId)
      .eq("recipient_id", userId);

    if (error) {
      throw new Error(error.message);
    }

    return json({
      ok: true,
      inviteId: payload.inviteId,
      status: nextStatus
    });
  } catch (error) {
    return json({ ok: false, error: toMessage(error) }, 400);
  }
});

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

