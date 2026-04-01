import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { readEnv } from "../_shared/env.ts";
import { json, parseJson } from "../_shared/http.ts";
import { assertRateLimit } from "../_shared/rate-limit.ts";

type ProfilePayload = {
  answers: Record<string, string>;
  summary?: string;
};

Deno.serve(async (req) => {
  try {
    const env = readEnv();
    const userId = await requireUserId(req, env);
    assertRateLimit(`upsert-profile:${userId}`);
    const payload = await parseJson<ProfilePayload>(req);
    const admin = createAdminClient(env);

    await admin.from("profiles").upsert({
      id: userId,
      updated_at: new Date().toISOString()
    });

    if (payload.answers && Object.keys(payload.answers).length > 0) {
      const facetRows = Object.entries(payload.answers).map(([facetKey, facetValue]) => ({
        profile_id: userId,
        facet_key: facetKey,
        facet_value: facetValue,
        facet_source: "onboarding"
      }));

      await admin.from("profile_facets").upsert(facetRows, {
        onConflict: "profile_id,facet_key,facet_value"
      });
    }

    return json({
      ok: true,
      profileId: userId,
      facetCount: Object.keys(payload.answers ?? {}).length
    });
  } catch (error) {
    return json({ ok: false, error: toMessage(error) }, 400);
  }
});

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

