export async function runSmoke() {
  const apiUrl = process.env.CLAWBUMP_SUPABASE_URL;
  const anonKey = process.env.CLAWBUMP_SUPABASE_ANON_KEY;

  if (!apiUrl || !anonKey) {
    throw new Error(
      "Missing hosted Supabase config. Set CLAWBUMP_SUPABASE_URL and CLAWBUMP_SUPABASE_ANON_KEY."
    );
  }

  const stamp = Date.now();
  const userA = await signInAnonymously(apiUrl, anonKey, `smoke-a-${stamp}`);
  const userB = await signInAnonymously(apiUrl, anonKey, `smoke-b-${stamp}`);

  await Promise.all([
    callFunction(apiUrl, anonKey, "upsert-profile", userA.accessToken, {
      answers: {
        domain: "ai-agents",
        stance: "contrarian",
        language: "zh"
      },
      summary: "深夜活跃，喜欢聊 agent 边界。"
    }),
    callFunction(apiUrl, anonKey, "upsert-profile", userB.accessToken, {
      answers: {
        domain: "ai-agents",
        stance: "builder",
        language: "en"
      },
      summary: "白天活跃，偏产品与落地。"
    })
  ]);

  const deferred = await callFunction(apiUrl, anonKey, "request-match", userA.accessToken, {
    topic: "AI agents",
    constraint: "skeptical product takes",
    audienceSegment: "ai-tech-startup",
    mode: "filtered"
  });

  if (deferred.mode !== "deferred" && deferred.mode !== "deduped") {
    throw new Error(`Expected first request to queue, got ${JSON.stringify(deferred)}`);
  }

  const live = await callFunction(apiUrl, anonKey, "request-match", userB.accessToken, {
    topic: "AI agents",
    constraint: "product skepticism",
    audienceSegment: "ai-tech-startup",
    mode: "filtered"
  });

  if (live.mode !== "live" || !live.session?.sessionId) {
    throw new Error(`Expected second request to create a live session, got ${JSON.stringify(live)}`);
  }

  const sessionId = live.session.sessionId;
  const inboxA = await callFunction(apiUrl, anonKey, "list-sessions", userA.accessToken, {
    statuses: ["live", "contact_shared", "ended"]
  });
  const ownMembership = inboxA.sessions.find((session) => session.sessionId === sessionId);
  if (!ownMembership) {
    throw new Error(`User A could not see the created session summary for ${sessionId}`);
  }

  const continueA = await callFunction(apiUrl, anonKey, "session-action", userA.accessToken, {
    sessionId,
    action: "continue_anonymous",
    feedbackRating: 5
  });
  if (continueA.state !== "pending") {
    throw new Error(`Expected first continue action to stay pending, got ${JSON.stringify(continueA)}`);
  }

  const relay = await callFunction(apiUrl, anonKey, "relay-message", userA.accessToken, {
    sessionId,
    body: "这个切口挺好，我想先听你为什么怀疑它。",
    messageType: "peer"
  });
  if (relay.relay?.senderShadowLabel !== ownMembership.shadowLabel) {
    throw new Error(`Relay sender shadow label mismatch: ${JSON.stringify(relay)}`);
  }

  const continueB = await callFunction(apiUrl, anonKey, "session-action", userB.accessToken, {
    sessionId,
    action: "continue_anonymous"
  });
  if (continueB.state !== "unlocked" || !continueB.eligibleForRematchAt) {
    throw new Error(`Expected second continue action to unlock rematch, got ${JSON.stringify(continueB)}`);
  }

  const shareA = await callFunction(apiUrl, anonKey, "session-action", userA.accessToken, {
    sessionId,
    action: "share_contact",
    contactValue: "tg://smoke-a"
  });
  if (shareA.state !== "pending") {
    throw new Error(`Expected first contact share to stay pending, got ${JSON.stringify(shareA)}`);
  }

  const shareB = await callFunction(apiUrl, anonKey, "session-action", userB.accessToken, {
    sessionId,
    action: "share_contact",
    contactValue: "tg://smoke-b"
  });
  if (shareB.state !== "unlocked" || shareB.peerContact?.value !== "tg://smoke-a") {
    throw new Error(`Expected mutual contact share to unlock with peer contact, got ${JSON.stringify(shareB)}`);
  }

  await callFunction(apiUrl, anonKey, "session-action", userA.accessToken, {
    sessionId,
    action: "leave_session"
  });

  const relayAfterLeave = await callFunctionExpectingFailure(
    apiUrl,
    anonKey,
    "relay-message",
    userB.accessToken,
    {
      sessionId,
      body: "还在吗？"
    }
  );
  if (!relayAfterLeave.includes("Only live sessions can relay messages.")) {
    throw new Error(`Expected relay-after-leave failure, got ${relayAfterLeave}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        sessionId,
        userAShadowLabel: ownMembership.shadowLabel,
        deferredMode: deferred.mode,
        liveMode: live.mode,
        continueUnlockedAt: continueB.eligibleForRematchAt,
        peerContact: shareB.peerContact
      },
      null,
      2
    )
  );
}

async function signInAnonymously(apiUrl, anonKey, label) {
  const response = await fetch(`${apiUrl}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      data: {
        label
      }
    })
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token || !payload.user?.id) {
    throw new Error(`Anonymous sign-in failed: ${JSON.stringify(payload)}`);
  }

  return {
    accessToken: payload.access_token,
    user: payload.user
  };
}

async function callFunction(apiUrl, anonKey, name, accessToken, body) {
  const response = await fetch(`${apiUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json();

  if (!response.ok || payload.ok === false) {
    throw new Error(`${name} failed: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function callFunctionExpectingFailure(apiUrl, anonKey, name, accessToken, body) {
  const response = await fetch(`${apiUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json();

  if (response.ok && payload.ok !== false) {
    throw new Error(`${name} unexpectedly succeeded: ${JSON.stringify(payload)}`);
  }

  return payload.error ?? JSON.stringify(payload);
}
