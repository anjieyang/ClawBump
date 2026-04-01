import { assertEquals } from "jsr:@std/assert";

import { pickLiveCandidate } from "../request-match/index.ts";

Deno.test("pickLiveCandidate prefers the highest compatibility live candidate", () => {
  const result = pickLiveCandidate([
    { profileId: "a", compatibility: 0.4, live: true },
    { profileId: "b", compatibility: 0.8, live: true },
    { profileId: "c", compatibility: 0.9, live: false }
  ]);

  assertEquals(result?.profileId, "b");
});

Deno.test("pickLiveCandidate ignores blocked and pending candidates", () => {
  const result = pickLiveCandidate([
    { profileId: "a", compatibility: 0.99, live: true, blocked: true },
    { profileId: "b", compatibility: 0.8, live: true, invitePending: true }
  ]);

  assertEquals(result, null);
});

