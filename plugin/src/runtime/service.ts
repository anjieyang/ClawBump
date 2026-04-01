import type {
  MatchIntent,
  RelayPayload,
  SessionActionPayload,
  SessionStatus
} from "../types/domain.js";

import { buildPresenceState } from "./presence.js";
import { createPoolPresenceChannel, createShadowSessionChannel } from "./realtime.js";
import { ClawBumpSupabaseAuth } from "./supabase-auth.js";

export class ClawBumpService {
  private readonly auth = new ClawBumpSupabaseAuth();

  async onboard(payload: { answers: Record<string, string>; summary?: string }) {
    return this.auth.invokeFunction("upsert-profile", payload);
  }

  async requestCollision(intent: MatchIntent) {
    return this.auth.invokeFunction("request-match", intent);
  }

  async listSessions(statuses: SessionStatus[] = ["live", "contact_shared", "ended"]) {
    return this.auth.invokeFunction("list-sessions", {
      statuses
    });
  }

  async relayMessage(payload: RelayPayload) {
    return this.auth.invokeFunction("relay-message", payload as Record<string, unknown>);
  }

  async sessionAction(payload: SessionActionPayload) {
    return this.auth.invokeFunction("session-action", payload as Record<string, unknown>);
  }

  async reportSession(payload: SessionActionPayload) {
    return this.auth.invokeFunction("report-session", payload as Record<string, unknown>);
  }

  async joinPoolPresence(segment: string, locale: string): Promise<() => Promise<void>> {
    const client = await this.auth.getAuthedClient();
    const session = await this.auth.ensureSession();
    const channel = createPoolPresenceChannel(client, segment);

    await subscribeChannel(channel);
    await channel.track(buildPresenceState(session.user.id, locale));

    return async () => {
      await channel.untrack();
      await channel.unsubscribe();
    };
  }

  async subscribeToSession(
    sessionId: string,
    handlers: {
      onRelay?: (payload: unknown) => void;
      onPresenceSync?: (payload: unknown) => void;
    }
  ): Promise<() => Promise<void>> {
    const client = await this.auth.getAuthedClient();
    const channel = createShadowSessionChannel(client, sessionId);

    if (handlers.onRelay) {
      channel.on("broadcast", { event: "clawbump_message" }, ({ payload }) => {
        handlers.onRelay?.(payload);
      });
    }

    if (handlers.onPresenceSync) {
      channel.on("presence", { event: "sync" }, () => {
        handlers.onPresenceSync?.(channel.presenceState());
      });
    }

    await subscribeChannel(channel);

    return async () => {
      await channel.unsubscribe();
    };
  }
}

async function subscribeChannel(channel: {
  subscribe: (callback: (status: string) => void) => unknown;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        resolve();
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        reject(new Error(`Failed to subscribe to ClawBump realtime channel: ${status}`));
      }
    });
  });
}
