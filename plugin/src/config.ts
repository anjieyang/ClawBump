export type ClawBumpConfig = {
  assistantAddress: string;
  defaultLocale: string;
  enableRealtimeRelay: boolean;
  enableContactExchange: boolean;
};

export const SUPABASE_URL = "https://rsdqouucbrkhdgzrixcw.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzZHFvdXVjYnJraGRnenJpeGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODc5NzQsImV4cCI6MjA5MDU2Mzk3NH0.tWunW0gtb-DGwjJ9thMXJ_-qattxV9J1osJ0QinDTzM";

export const pluginConfigSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    assistantAddress: { type: "string", default: "龙虾" },
    defaultLocale: { type: "string", default: "zh-CN" },
    enableRealtimeRelay: { type: "boolean", default: true },
    enableContactExchange: { type: "boolean", default: true }
  }
} as const;

const DEFAULTS: ClawBumpConfig = {
  assistantAddress: "龙虾",
  defaultLocale: "zh-CN",
  enableRealtimeRelay: true,
  enableContactExchange: true
};

export function resolveConfig(raw: unknown): ClawBumpConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULTS };
  }

  const input = raw as Record<string, unknown>;

  return {
    assistantAddress: asOptionalString(input.assistantAddress) ?? DEFAULTS.assistantAddress,
    defaultLocale: asOptionalString(input.defaultLocale) ?? DEFAULTS.defaultLocale,
    enableRealtimeRelay: asOptionalBoolean(input.enableRealtimeRelay) ?? DEFAULTS.enableRealtimeRelay,
    enableContactExchange:
      asOptionalBoolean(input.enableContactExchange) ?? DEFAULTS.enableContactExchange
  };
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

