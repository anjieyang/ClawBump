import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

export type SessionStore = {
  loadSession: () => Promise<string | null>;
  saveSession: (value: string) => Promise<void>;
  clearSession: () => Promise<void>;
};

export class MemorySessionStore implements SessionStore {
  private value: string | null = null;

  async loadSession(): Promise<string | null> {
    return this.value;
  }

  async saveSession(value: string): Promise<void> {
    this.value = value;
  }

  async clearSession(): Promise<void> {
    this.value = null;
  }
}

export class ClawBumpSupabaseAuth {
  private readonly client: SupabaseClient;

  constructor(private readonly store: SessionStore = new MemorySessionStore()) {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  async getAuthedClient(): Promise<SupabaseClient> {
    await this.ensureSession();
    return this.client;
  }

  async ensureSession(): Promise<Session> {
    const stored = await this.store.loadSession();
    if (stored) {
      const restored = JSON.parse(stored) as {
        access_token: string;
        refresh_token: string;
      };
      const { data, error } = await this.client.auth.setSession(restored);
      if (!error && data.session) {
        await this.client.realtime.setAuth(data.session.access_token);
        return data.session;
      }
    }

    const { data, error } = await this.client.auth.signInAnonymously();
    if (error || !data.session) {
      throw new Error(error?.message ?? "Failed to create ClawBump anonymous session.");
    }

    await this.store.saveSession(
      JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      })
    );
    await this.client.realtime.setAuth(data.session.access_token);

    return data.session;
  }

  async invokeFunction<TPayload extends Record<string, unknown>>(name: string, payload: TPayload) {
    const session = await this.ensureSession();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`ClawBump function "${name}" failed with ${response.status}.`);
    }

    return response.json();
  }
}
