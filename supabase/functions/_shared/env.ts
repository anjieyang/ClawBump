export type FunctionEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
};

export function readEnv(): FunctionEnv {
  return {
    supabaseUrl: requireEnv("SUPABASE_URL"),
    supabaseAnonKey: requireEnv("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  };
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required env var ${name}.`);
  }

  return value;
}

