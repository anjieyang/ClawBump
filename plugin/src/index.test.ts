import { describe, expect, it, vi } from "vitest";

import plugin from "./index.js";

describe("ClawBump plugin registration", () => {
  it("registers tools and the optional command surface", () => {
    const registerTool = vi.fn();
    const registerCommand = vi.fn();
    const registerService = vi.fn();

    plugin.register({
      pluginConfig: {
        supabaseUrl: "https://example-project.supabase.co",
        supabaseAnonKey: "anon-key"
      },
      registerTool,
      registerCommand,
      registerService
    });

    expect(registerTool).toHaveBeenCalledTimes(3);
    expect(registerCommand).toHaveBeenCalledTimes(1);
    expect(registerService).toHaveBeenCalledWith(expect.objectContaining({ id: "clawbump" }));
  });

  it("registers with zero config using hosted backend defaults", () => {
    const registerTool = vi.fn();
    const registerCommand = vi.fn();
    const registerService = vi.fn();

    plugin.register({
      registerTool,
      registerCommand,
      registerService
    });

    expect(registerTool).toHaveBeenCalledTimes(3);
    expect(registerCommand).toHaveBeenCalledTimes(1);
    expect(registerService).toHaveBeenCalledWith(expect.objectContaining({ id: "clawbump" }));
  });
});
