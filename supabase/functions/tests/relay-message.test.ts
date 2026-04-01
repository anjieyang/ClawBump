import { assertEquals } from "jsr:@std/assert";

import { buildRelayEnvelope } from "../relay-message/index.ts";

Deno.test("buildRelayEnvelope defaults to peer messages", () => {
  const envelope = buildRelayEnvelope(
    {
      sessionId: "session-1",
      body: "hello"
    },
    {
      memberId: "member-1",
      shadowLabel: "Shadow A"
    }
  );

  assertEquals(envelope.messageType, "peer");
  assertEquals(envelope.senderMemberId, "member-1");
  assertEquals(envelope.senderShadowLabel, "Shadow A");
});
