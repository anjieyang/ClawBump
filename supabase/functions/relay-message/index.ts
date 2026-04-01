import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { readEnv } from "../_shared/env.ts";
import { json, parseJson } from "../_shared/http.ts";
import { assertRateLimit } from "../_shared/rate-limit.ts";

type RelayPayload = {
  sessionId: string;
  body: string;
  messageType?: "peer" | "assistant_note";
};

type RelaySender = {
  memberId: string;
  shadowLabel: string;
};

export function buildRelayEnvelope(payload: RelayPayload, sender: RelaySender) {
  return {
    sessionId: payload.sessionId,
    senderMemberId: sender.memberId,
    senderShadowLabel: sender.shadowLabel,
    messageType: payload.messageType ?? "peer",
    body: payload.body.trim(),
    deliveredAt: new Date().toISOString()
  };
}

Deno.serve(async (req) => {
  try {
    const env = readEnv();
    const userId = await requireUserId(req, env);
    assertRateLimit(`relay-message:${userId}`);
    const payload = await parseJson<RelayPayload>(req);
    const admin = createAdminClient(env);

    if (!hasText(payload.body)) {
      throw new Error("Message body is required.");
    }

    const [{ data: session, error: sessionError }, { data: member, error: memberError }] =
      await Promise.all([
        admin.from("shadow_sessions").select("id,status").eq("id", payload.sessionId).single(),
        admin
          .from("shadow_session_members")
          .select("id,shadow_label")
          .eq("session_id", payload.sessionId)
          .eq("profile_id", userId)
          .single()
      ]);

    if (sessionError || !session) {
      throw new Error(sessionError?.message ?? "Shadow session not found.");
    }

    if (session.status !== "live") {
      throw new Error("Only live sessions can relay messages.");
    }

    if (memberError || !member) {
      throw new Error(memberError?.message ?? "Only session members can relay messages.");
    }

    const relay = buildRelayEnvelope(
      {
        ...payload,
        body: payload.body.trim()
      },
      {
        memberId: member.id,
        shadowLabel: member.shadow_label
      }
    );

    await broadcastRelay(env, payload.sessionId, relay);

    return json({
      ok: true,
      relay
    });
  } catch (error) {
    return json({ ok: false, error: toMessage(error) }, 400);
  }
});

async function broadcastRelay(
  env: ReturnType<typeof readEnv>,
  sessionId: string,
  relay: ReturnType<typeof buildRelayEnvelope>
) {
  const response = await fetch(`${env.supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      apikey: env.supabaseServiceRoleKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `shadow-session:${sessionId}`,
          event: "clawbump_message",
          payload: relay
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Realtime broadcast failed: ${response.status} ${detail}`.trim());
  }
}

function hasText(value?: string): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
