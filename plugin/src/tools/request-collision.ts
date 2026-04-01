import { Type } from "@sinclair/typebox";

import type { OpenClawTool } from "../types/openclaw.js";
import type { ClawBumpService } from "../runtime/service.js";

export function buildRequestCollisionTool(service: ClawBumpService): OpenClawTool {
  return {
    name: "clawbump_request_collision",
    description: "Request a new ClawBump match using the current intent and default audience segment.",
    parameters: Type.Object({
      topic: Type.Optional(Type.String()),
      constraint: Type.Optional(Type.String()),
      audienceSegment: Type.Optional(Type.String()),
      mode: Type.Optional(Type.String())
    }),
    async execute(_id, params) {
      const result = await service.requestCollision({
        topic: typeof params.topic === "string" ? params.topic : undefined,
        constraint: typeof params.constraint === "string" ? params.constraint : undefined,
        audienceSegment:
          typeof params.audienceSegment === "string" ? params.audienceSegment : undefined,
        mode: params.mode === "filtered" ? "filtered" : "blind"
      });

      return {
        content: [
          {
            type: "text",
            text: `ClawBump match request submitted.${renderCompactJson(result)}`
          }
        ]
      };
    }
  };
}

function renderCompactJson(value: unknown): string {
  return value ? ` ${JSON.stringify(value)}` : "";
}

