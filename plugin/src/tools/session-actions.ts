import { Type } from "@sinclair/typebox";

import type { OpenClawTool } from "../types/openclaw.js";
import type { ClawBumpService } from "../runtime/service.js";
import type { SessionActionKind } from "../types/domain.js";

export function buildSessionActionsTool(service: ClawBumpService): OpenClawTool {
  return {
    name: "clawbump_session_action",
    description: "Apply a high-risk ClawBump session action such as continue, contact share, leave, or report.",
    parameters: Type.Object({
      sessionId: Type.String(),
      action: Type.String(),
      contactValue: Type.Optional(Type.String()),
      feedbackRating: Type.Optional(Type.Number()),
      reportReason: Type.Optional(Type.String()),
      reportDetail: Type.Optional(Type.String())
    }),
    async execute(_id, params) {
      const action = normalizeAction(params.action);
      const result =
        action === "report_session"
          ? await service.reportSession({
              sessionId: String(params.sessionId),
              action,
              reportReason: optionalString(params.reportReason),
              reportDetail: optionalString(params.reportDetail)
            })
          : await service.sessionAction({
              sessionId: String(params.sessionId),
              action,
              contactValue: optionalString(params.contactValue),
              feedbackRating:
                typeof params.feedbackRating === "number" ? params.feedbackRating : undefined,
              reportReason: optionalString(params.reportReason),
              reportDetail: optionalString(params.reportDetail)
            });

      return {
        content: [
          {
            type: "text",
            text: `ClawBump session action applied.${renderCompactJson(result)}`
          }
        ]
      };
    }
  };
}

function normalizeAction(value: unknown): SessionActionKind {
  switch (value) {
    case "continue_anonymous":
    case "share_contact":
    case "leave_session":
    case "report_session":
      return value;
    default:
      throw new Error(`Unsupported ClawBump session action: ${String(value)}`);
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function renderCompactJson(value: unknown): string {
  return value ? ` ${JSON.stringify(value)}` : "";
}

