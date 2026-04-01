import { assertEquals } from "jsr:@std/assert";

import { resolveConsentState } from "../session-action/index.ts";

Deno.test("resolveConsentState unlocks when everyone accepted", () => {
  assertEquals(resolveConsentState(["accepted", "accepted"]), "unlocked");
});

Deno.test("resolveConsentState stays pending when only one side accepted", () => {
  assertEquals(resolveConsentState(["accepted"]), "pending");
});

Deno.test("resolveConsentState stays pending while only one side accepted", () => {
  assertEquals(resolveConsentState(["accepted", "pending"]), "pending");
});

Deno.test("resolveConsentState locks if any side declined", () => {
  assertEquals(resolveConsentState(["accepted", "declined"]), "locked");
});
