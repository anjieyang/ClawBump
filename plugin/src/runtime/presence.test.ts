import { describe, expect, it } from "vitest";

import { buildPresenceState } from "./presence.js";

describe("buildPresenceState", () => {
  it("builds a valid presence object", () => {
    const state = buildPresenceState("user-123", "zh-CN");

    expect(state.profileId).toBe("user-123");
    expect(state.locale).toBe("zh-CN");
    expect(state.status).toBe("live");
    expect(typeof state.updatedAt).toBe("string");
    expect(new Date(state.updatedAt).getTime()).not.toBeNaN();
  });

  it("always sets status to live", () => {
    const state = buildPresenceState("x", "en");

    expect(state.status).toBe("live");
  });
});
