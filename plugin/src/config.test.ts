import { describe, expect, it } from "vitest";

import { resolveConfig } from "./config.js";

describe("resolveConfig", () => {
  it("returns all defaults for null config", () => {
    const config = resolveConfig(null);

    expect(config.assistantAddress).toBe("龙虾");
    expect(config.defaultLocale).toBe("zh-CN");
    expect(config.enableRealtimeRelay).toBe(true);
    expect(config.enableContactExchange).toBe(true);
  });

  it("returns all defaults for undefined config", () => {
    const config = resolveConfig(undefined);

    expect(config.assistantAddress).toBe("龙虾");
  });

  it("returns all defaults for a non-object config", () => {
    const config = resolveConfig("not-an-object");

    expect(config.assistantAddress).toBe("龙虾");
  });

  it("returns all defaults for an empty object", () => {
    const config = resolveConfig({});

    expect(config.assistantAddress).toBe("龙虾");
    expect(config.defaultLocale).toBe("zh-CN");
    expect(config.enableRealtimeRelay).toBe(true);
    expect(config.enableContactExchange).toBe(true);
  });

  it("applies overrides for all fields", () => {
    const config = resolveConfig({
      assistantAddress: "小助手",
      defaultLocale: "en-US",
      enableRealtimeRelay: false,
      enableContactExchange: false
    });

    expect(config.assistantAddress).toBe("小助手");
    expect(config.defaultLocale).toBe("en-US");
    expect(config.enableRealtimeRelay).toBe(false);
    expect(config.enableContactExchange).toBe(false);
  });

  it("trims whitespace from string fields", () => {
    const config = resolveConfig({
      assistantAddress: "  Bot  ",
      defaultLocale: "  en  "
    });

    expect(config.assistantAddress).toBe("Bot");
    expect(config.defaultLocale).toBe("en");
  });

  it("ignores non-boolean values for enableRealtimeRelay", () => {
    const config = resolveConfig({ enableRealtimeRelay: "yes" as unknown });

    expect(config.enableRealtimeRelay).toBe(true);
  });

  it("ignores empty string assistantAddress and falls back to default", () => {
    const config = resolveConfig({ assistantAddress: "   " });

    expect(config.assistantAddress).toBe("龙虾");
  });
});
