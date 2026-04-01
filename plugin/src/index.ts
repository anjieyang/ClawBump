import { buildBumpCommand } from "./commands/bump.js";
import { pluginConfigSchema, resolveConfig } from "./config.js";
import { ClawBumpSessionManager } from "./runtime/session-manager.js";
import { ClawBumpService } from "./runtime/service.js";
import { buildJoinPoolTool } from "./tools/join-pool.js";
import { buildRequestCollisionTool } from "./tools/request-collision.js";
import { buildSessionActionsTool } from "./tools/session-actions.js";
import type { OpenClawApi } from "./types/openclaw.js";

export function register(api: OpenClawApi) {
  const config = resolveConfig(api.pluginConfig);
  const service = new ClawBumpService();
  const runtime = new ClawBumpSessionManager({
    service,
    assistantAddress: config.assistantAddress,
    defaultLocale: config.defaultLocale
  });

  api.registerTool(buildJoinPoolTool(service));
  api.registerTool(buildRequestCollisionTool(service), { optional: true });
  api.registerTool(buildSessionActionsTool(service), { optional: true });

  if (api.registerCommand) {
    api.registerCommand(buildBumpCommand(runtime));
  }

  if (api.registerService) {
    api.registerService({
      id: "clawbump",
      start() {
        /* runtime is ready from construction; nothing async to bootstrap */
      }
    });
  }
}

const plugin = {
  id: "clawbump",
  name: "ClawBump",
  configSchema: pluginConfigSchema,
  register
};

export default plugin;
