import { createClient } from "jsr:@supabase/supabase-js@2";

import type { FunctionEnv } from "./env.ts";

export function createUserClient(req: Request, env: FunctionEnv) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? ""
      }
    }
  });
}

export function createAdminClient(env: FunctionEnv) {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
}

export async function requireUserId(req: Request, env: FunctionEnv): Promise<string> {
  const client = createUserClient(req, env);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Unauthorized request.");
  }

  return data.user.id;
}

