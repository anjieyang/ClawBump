import { Type } from "@sinclair/typebox";

import type { OpenClawTool } from "../types/openclaw.js";
import type { ClawBumpService } from "../runtime/service.js";

export function buildJoinPoolTool(service: ClawBumpService): OpenClawTool {
  return {
    name: "clawbump_join_pool",
    description: "Create or refresh the current install's ClawBump collision profile.",
    parameters: Type.Object({
      answers: Type.Record(Type.String(), Type.String()),
      summary: Type.Optional(Type.String())
    }),
    async execute(_id, params) {
      const result = await service.onboard({
        answers: (params.answers as Record<string, string>) ?? {},
        summary: typeof params.summary === "string" ? params.summary : undefined
      });

      return {
        content: [
          {
            type: "text",
            text: `ClawBump profile synced.${renderCompactJson(result)}`
          }
        ]
      };
    }
  };
}

function renderCompactJson(value: unknown): string {
  return value ? ` ${JSON.stringify(value)}` : "";
}

