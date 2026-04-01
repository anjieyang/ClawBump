import type { SupabaseClient } from "@supabase/supabase-js";

import { buildPoolTopic, buildShadowSessionTopic } from "./session-topics.js";

export function createPoolPresenceChannel(client: SupabaseClient, segment: string) {
  return client.channel(buildPoolTopic(segment), {
    config: {
      private: true,
      presence: {
        key: `pool:${segment}`
      }
    }
  });
}

export function createShadowSessionChannel(client: SupabaseClient, sessionId: string) {
  return client.channel(buildShadowSessionTopic(sessionId), {
    config: {
      private: true,
      broadcast: {
        self: false
      },
      presence: {
        key: `shadow-session:${sessionId}`
      }
    }
  });
}
