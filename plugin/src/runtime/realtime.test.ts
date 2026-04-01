import { describe, expect, it, vi } from "vitest";

import { createPoolPresenceChannel, createShadowSessionChannel } from "./realtime.js";

describe("Realtime channel helpers", () => {
  it("creates a private pool presence channel", () => {
    const channel = vi.fn();
    const client = {
      channel
    } as never;

    createPoolPresenceChannel(client, "ai-tech-startup");

    expect(channel).toHaveBeenCalledWith("pool:ai-tech-startup", {
      config: {
        private: true,
        presence: {
          key: "pool:ai-tech-startup"
        }
      }
    });
  });

  it("creates a private shadow session channel with broadcast disabled for self", () => {
    const channel = vi.fn();
    const client = {
      channel
    } as never;

    createShadowSessionChannel(client, "session-123");

    expect(channel).toHaveBeenCalledWith("shadow-session:session-123", {
      config: {
        private: true,
        broadcast: {
          self: false
        },
        presence: {
          key: "shadow-session:session-123"
        }
      }
    });
  });
});
