export type OpenClawTool = {
  name: string;
  description: string;
  parameters: unknown;
  execute: (id: string, params: Record<string, unknown>) => Promise<{
    content: Array<{ type: "text"; text: string }>;
  }>;
};

export type OpenClawCommand = {
  name: string;
  description: string;
  handler: (args?: string) => Promise<string>;
};

export type OpenClawPluginService = {
  id: string;
  start: (ctx: unknown) => void | Promise<void>;
  stop?: (ctx: unknown) => void | Promise<void>;
};

export type OpenClawApi = {
  pluginConfig?: unknown;
  registerTool: (tool: OpenClawTool, options?: { optional?: boolean }) => void;
  registerCommand?: (command: OpenClawCommand) => void;
  registerService?: (service: OpenClawPluginService) => void;
  log?: (level: "info" | "warn" | "error", message: string, meta?: unknown) => void;
};

