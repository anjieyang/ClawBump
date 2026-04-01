import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { readEnv } from "../_shared/env.ts";
import { json, parseJson } from "../_shared/http.ts";
import { assertRateLimit } from "../_shared/rate-limit.ts";

type MatchRequestPayload = {
  topic?: string;
  constraint?: string;
  audienceSegment?: string;
  mode?: "blind" | "filtered";
};

type MatchRequestRow = {
  id: string;
  requester_id: string;
  topic: string | null;
  constraint_text: string | null;
  audience_segment: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_locale: string;
};

type ProfileFacetRow = {
  profile_id: string;
  facet_key: string;
  facet_value: string;
};

type Candidate = {
  profileId: string;
  requestId: string;
  request: MatchRequestRow;
  compatibility: number;
  live: boolean;
  locale?: string;
  sharedFacetLabels?: string[];
  blocked?: boolean;
  invitePending?: boolean;
};

export function pickLiveCandidate(candidates: Candidate[]): Candidate | null {
  return (
    candidates
      .filter((candidate) => candidate.live && !candidate.blocked && !candidate.invitePending)
      .sort((left, right) => right.compatibility - left.compatibility || left.profileId.localeCompare(right.profileId))[0] ??
    null
  );
}

Deno.serve(async (req) => {
  try {
    const env = readEnv();
    const userId = await requireUserId(req, env);
    assertRateLimit(`request-match:${userId}`);
    const payload = await parseJson<MatchRequestPayload>(req);
    const admin = createAdminClient(env);
    const now = new Date().toISOString();
    const audienceSegment = payload.audienceSegment ?? "ai-tech-startup";

    await ensureProfile(admin, userId, audienceSegment);

    const currentRequest = await getOrCreateOpenRequest(admin, {
      userId,
      payload,
      audienceSegment
    });
    const candidate = await findCandidate(admin, {
      userId,
      payload,
      audienceSegment,
      currentRequest
    });

    if (!candidate) {
      return json({
        ok: true,
        mode: currentRequest.existed ? "deduped" : "deferred",
        requestId: currentRequest.row.id
      });
    }

    const claimedCandidate = await claimOpenRequest(admin, candidate.requestId, now);
    if (!claimedCandidate) {
      return json({
        ok: true,
        mode: "deduped",
        requestId: currentRequest.row.id
      });
    }

    await closeOwnRequest(admin, currentRequest.row.id, userId, now);

    const sessionCopy = buildSessionCopy({
      selfRequest: currentRequest.row,
      peerRequest: claimedCandidate,
      sharedFacetLabels: candidate.sharedFacetLabels ?? []
    });
    const session = await createShadowSession(admin, {
      createdAt: now,
      currentUserId: userId,
      currentRequest: currentRequest.row,
      peerRequest: claimedCandidate,
      introSummary: sessionCopy.introSummary,
      openerPrompt: sessionCopy.openerPrompt
    });

    return json({
      ok: true,
      mode: "live",
      requestId: currentRequest.row.id,
      session: {
        sessionId: session.sessionId,
        shadowLabel: session.shadowLabel,
        introSummary: sessionCopy.introSummary,
        openerPrompt: sessionCopy.openerPrompt,
        peerLocale: candidate.locale
      },
      compatibility: buildCompatibilitySummary({
        score: candidate.compatibility,
        sharedFacetLabels: candidate.sharedFacetLabels ?? [],
        requestedTopic: payload.topic ?? currentRequest.row.topic ?? null,
        peerTopic: claimedCandidate.topic
      })
    });
  } catch (error) {
    return json({ ok: false, error: toMessage(error) }, 400);
  }
});

async function ensureProfile(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  audienceSegment: string
) {
  const { error } = await admin.from("profiles").upsert({
    id: userId,
    audience_segment: audienceSegment,
    updated_at: new Date().toISOString()
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function getOrCreateOpenRequest(
  admin: ReturnType<typeof createAdminClient>,
  options: {
    userId: string;
    payload: MatchRequestPayload;
    audienceSegment: string;
  }
): Promise<{ row: MatchRequestRow; existed: boolean }> {
  const { userId, payload, audienceSegment } = options;
  const { data: existing, error: existingError } = await admin
    .from("match_requests")
    .select("id,requester_id,topic,constraint_text,audience_segment,created_at")
    .eq("requester_id", userId)
    .eq("status", "open")
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return {
      row: existing as MatchRequestRow,
      existed: true
    };
  }

  const { data: inserted, error } = await admin
    .from("match_requests")
    .insert({
      requester_id: userId,
      topic: payload.topic ?? null,
      constraint_text: payload.constraint ?? null,
      audience_segment: audienceSegment,
      availability_mode: "hybrid"
    })
    .select("id,requester_id,topic,constraint_text,audience_segment,created_at")
    .single();

  if (error || !inserted) {
    throw new Error(error?.message ?? "Failed to create match request.");
  }

  return {
    row: inserted as MatchRequestRow,
    existed: false
  };
}

async function findCandidate(
  admin: ReturnType<typeof createAdminClient>,
  options: {
    userId: string;
    payload: MatchRequestPayload;
    audienceSegment: string;
    currentRequest: { row: MatchRequestRow };
  }
): Promise<Candidate | null> {
  const { userId, payload, audienceSegment } = options;
  const now = new Date().toISOString();

  const { data: candidateRequests, error: requestError } = await admin
    .from("match_requests")
    .select("id,requester_id,topic,constraint_text,audience_segment,created_at")
    .eq("status", "open")
    .eq("audience_segment", audienceSegment)
    .neq("requester_id", userId)
    .gt("expires_at", now)
    .order("created_at", { ascending: true })
    .limit(20);

  if (requestError) {
    throw new Error(requestError.message);
  }

  if (!candidateRequests || candidateRequests.length === 0) {
    return null;
  }

  const candidateProfileIds = candidateRequests.map((row) => row.requester_id);

  const [{ data: profiles, error: profileError }, { data: facets, error: facetError }, { data: blocks, error: blockError }] =
    await Promise.all([
      admin.from("profiles").select("id,display_locale").in("id", candidateProfileIds),
      admin
        .from("profile_facets")
        .select("profile_id,facet_key,facet_value")
        .in("profile_id", [userId, ...candidateProfileIds]),
      admin
        .from("blocks")
        .select("blocker_profile_id,blocked_profile_id")
        .or(`blocker_profile_id.eq.${userId},blocked_profile_id.eq.${userId}`)
    ]);

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (facetError) {
    throw new Error(facetError.message);
  }

  if (blockError) {
    throw new Error(blockError.message);
  }

  const profileMap = new Map<string, ProfileRow>(
    (profiles ?? []).map((profile) => [profile.id, profile as ProfileRow])
  );
  const allFacets = (facets ?? []) as ProfileFacetRow[];
  const selfFacets = allFacets.filter((facet) => facet.profile_id === userId);

  const candidates = (candidateRequests as MatchRequestRow[]).map((row) => {
    const candidateFacets = allFacets.filter((facet) => facet.profile_id === row.requester_id);
    const sharedFacetLabels = buildSharedFacetLabels(selfFacets, candidateFacets);
    const blocked = (blocks ?? []).some(
      (entry) =>
        (entry.blocker_profile_id === userId && entry.blocked_profile_id === row.requester_id) ||
        (entry.blocked_profile_id === userId && entry.blocker_profile_id === row.requester_id)
    );

    return {
      profileId: row.requester_id,
      requestId: row.id,
      request: row,
      compatibility: scoreCandidate(payload, row, sharedFacetLabels),
      live: true,
      locale: profileMap.get(row.requester_id)?.display_locale,
      sharedFacetLabels,
      blocked
    } satisfies Candidate;
  });

  const selected = pickLiveCandidate(candidates);
  if (!selected) {
    return null;
  }

  if (payload.mode === "filtered" && selected.compatibility < 0.45) {
    return null;
  }

  return selected;
}

async function claimOpenRequest(
  admin: ReturnType<typeof createAdminClient>,
  requestId: string,
  claimedAt: string
): Promise<MatchRequestRow | null> {
  const { data, error } = await admin
    .from("match_requests")
    .update({
      status: "matched",
      fulfilled_at: claimedAt
    })
    .eq("id", requestId)
    .eq("status", "open")
    .select("id,requester_id,topic,constraint_text,audience_segment,created_at")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MatchRequestRow | null) ?? null;
}

async function closeOwnRequest(
  admin: ReturnType<typeof createAdminClient>,
  requestId: string,
  userId: string,
  closedAt: string
) {
  const { error } = await admin
    .from("match_requests")
    .update({
      status: "matched",
      fulfilled_at: closedAt
    })
    .eq("id", requestId)
    .eq("requester_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function createShadowSession(
  admin: ReturnType<typeof createAdminClient>,
  options: {
    createdAt: string;
    currentUserId: string;
    currentRequest: MatchRequestRow;
    peerRequest: MatchRequestRow;
    introSummary: string;
    openerPrompt: string;
  }
) {
  const { createdAt, currentUserId, currentRequest, peerRequest, introSummary, openerPrompt } = options;
  const { data: session, error: sessionError } = await admin
    .from("shadow_sessions")
    .insert({
      source_request_id: currentRequest.id,
      intro_summary: introSummary,
      opener_prompt: openerPrompt,
      status: "live",
      started_at: createdAt
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? "Failed to create shadow session.");
  }

  const members = assignShadowLabels(currentRequest, peerRequest).map((member) => ({
    session_id: session.id,
    profile_id: member.profileId,
    shadow_label: member.shadowLabel
  }));

  const { error: memberError } = await admin.from("shadow_session_members").insert(members);
  if (memberError) {
    await admin.from("shadow_sessions").delete().eq("id", session.id);
    throw new Error(memberError.message);
  }

  const currentMember = members.find((member) => member.profile_id === currentUserId);
  if (!currentMember) {
    throw new Error("Current user was not added to the created shadow session.");
  }

  return {
    sessionId: session.id,
    shadowLabel: currentMember.shadow_label
  };
}

function assignShadowLabels(currentRequest: MatchRequestRow, peerRequest: MatchRequestRow) {
  const currentFirst =
    currentRequest.created_at <= peerRequest.created_at ||
    (currentRequest.created_at === peerRequest.created_at &&
      currentRequest.requester_id.localeCompare(peerRequest.requester_id) < 0);

  if (currentFirst) {
    return [
      { profileId: currentRequest.requester_id, shadowLabel: "Shadow A" },
      { profileId: peerRequest.requester_id, shadowLabel: "Shadow B" }
    ];
  }

  return [
    { profileId: currentRequest.requester_id, shadowLabel: "Shadow B" },
    { profileId: peerRequest.requester_id, shadowLabel: "Shadow A" }
  ];
}

function buildSharedFacetLabels(selfFacets: ProfileFacetRow[], candidateFacets: ProfileFacetRow[]): string[] {
  const own = new Set(selfFacets.map((facet) => `${facet.facet_key}:${normalizeText(facet.facet_value)}`));
  const shared = candidateFacets
    .filter((facet) => own.has(`${facet.facet_key}:${normalizeText(facet.facet_value)}`))
    .map((facet) => facet.facet_value.trim())
    .filter((value) => value.length > 0);

  return Array.from(new Set(shared)).slice(0, 3);
}

function scoreCandidate(
  payload: MatchRequestPayload,
  request: MatchRequestRow,
  sharedFacetLabels: string[]
): number {
  let score = 0.2;

  score += compareText(payload.topic, request.topic) * 0.45;
  score += compareText(payload.constraint, request.constraint_text) * 0.2;
  score += Math.min(sharedFacetLabels.length, 3) * 0.1;
  score += payload.audienceSegment && payload.audienceSegment === request.audience_segment ? 0.1 : 0.05;

  return Number(Math.min(score, 1).toFixed(2));
}

function compareText(left?: string | null, right?: string | null): number {
  const leftTokens = buildTokenSet(left);
  const rightTokens = buildTokenSet(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap === 0 ? 0 : overlap / Math.max(leftTokens.size, rightTokens.size);
}

function buildTokenSet(value?: string | null): Set<string> {
  const normalized = normalizeText(value);
  if (!normalized) {
    return new Set();
  }

  const parts = normalized
    .replace(/[，。！？、/]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

  if (parts.length === 0) {
    return new Set([normalized]);
  }

  return new Set(parts);
}

function normalizeText(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function buildSessionCopy(options: {
  selfRequest: MatchRequestRow;
  peerRequest: MatchRequestRow;
  sharedFacetLabels: string[];
}) {
  const { selfRequest, peerRequest, sharedFacetLabels } = options;
  const sharedLine =
    sharedFacetLabels.length > 0
      ? `你们都带着 ${sharedFacetLabels.join("、")} 这个底色。`
      : "你们的背景不完全一样，但关心的议题足够接近。";
  const selfTopic = selfRequest.topic ?? selfRequest.constraint_text ?? "最近在意的问题";
  const peerTopic = peerRequest.topic ?? peerRequest.constraint_text ?? "另一个切口";

  return {
    introSummary: `${sharedLine} 这次碰撞里，一个更偏 ${selfTopic}，另一个更偏 ${peerTopic}。`,
    openerPrompt: `先轻一点开场：你们都不是来闲聊的，但切入点不一样。可以先各自说说，为什么最近会对“${selfTopic} / ${peerTopic}”上头。`
  };
}

function buildCompatibilitySummary(options: {
  score: number;
  sharedFacetLabels: string[];
  requestedTopic: string | null;
  peerTopic: string | null;
}) {
  return {
    score: options.score,
    sharedFacets: options.sharedFacetLabels,
    requestedTopic: options.requestedTopic,
    peerTopic: options.peerTopic
  };
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
