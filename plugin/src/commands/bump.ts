import type { OpenClawCommand } from "../types/openclaw.js";

type BumpRuntime = {
  continueAnonymous: () => Promise<string>;
  describeCurrentSession: () => string;
  leaveSession: () => Promise<string>;
  reportSession: (reason: string, detail?: string) => Promise<string>;
  requestCollision: (intent: { topic?: string; constraint?: string; mode?: "blind" | "filtered" }) => Promise<string>;
  send: (text: string) => Promise<string>;
  shareContact: (contactValue: string) => Promise<string>;
  syncSessions: () => Promise<string>;
  useSession: (sessionId: string) => Promise<string>;
};

export function buildBumpCommand(runtime: BumpRuntime): OpenClawCommand {
  return {
    name: "bump",
    description: "ClawBump helper command. Use slash tools for continue/contact/report actions.",
    acceptsArgs: true,
    async handler(args) {
      if (!args || args.trim().length === 0) {
        return [
          "ClawBump 已安装。",
          runtime.describeCurrentSession(),
          "命令：find [topic] | inbox | use <sessionId> | continue | contact <value> | leave | report <reason> | 直接输入内容发送"
        ].join("\n");
      }

      const input = args.trim();
      const [command, ...restParts] = input.split(/\s+/);
      const rest = restParts.join(" ").trim();

      switch (command) {
        case "find":
          return runtime.requestCollision({
            topic: rest || undefined,
            mode: rest ? "filtered" : "blind"
          });
        case "inbox":
        case "status":
          return runtime.syncSessions();
        case "use":
          return rest ? runtime.useSession(rest) : "请给出 sessionId。";
        case "continue":
          return runtime.continueAnonymous();
        case "contact":
          return rest ? runtime.shareContact(rest) : "请给出你要交换的联系方式。";
        case "leave":
          return runtime.leaveSession();
        case "report": {
          const [reason, ...detailParts] = rest.split(/\s+/);
          return reason
            ? runtime.reportSession(reason, detailParts.join(" ").trim() || undefined)
            : "请给出举报原因。";
        }
        case "send":
          return rest ? runtime.send(rest) : "请给出你要发给影子的内容。";
        default:
          return runtime.send(input);
      }
    }
  };
}
