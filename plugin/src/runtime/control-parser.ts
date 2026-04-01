export type ParsedControlInput =
  | {
      kind: "assistant";
      mode: "addressed" | "slash";
      rawText: string;
      body: string;
    }
  | {
      kind: "peer";
      rawText: string;
      body: string;
    }
  | {
      kind: "ambiguous";
      rawText: string;
      reason: string;
    };

type ParseControlInputParams = {
  text: string;
  assistantAddress: string;
};

const AMBIGUOUS_PATTERNS = [
  /^帮我/,
  /^先别发/,
  /^别发/,
  /^不要发/,
  /^替我/,
  /^提议解锁/,
  /^解锁轮廓/,
  /^交换联系方式/,
  /^想一个/
];

export function parseControlInput(params: ParseControlInputParams): ParsedControlInput {
  const rawText = params.text.trim();

  if (rawText.length === 0) {
    return {
      kind: "peer",
      rawText,
      body: rawText
    };
  }

  if (rawText.startsWith("/")) {
    return {
      kind: "assistant",
      mode: "slash",
      rawText,
      body: rawText
    };
  }

  const addressedBody = stripAssistantAddress(rawText, params.assistantAddress);
  if (addressedBody !== null) {
    return {
      kind: "assistant",
      mode: "addressed",
      rawText,
      body: addressedBody
    };
  }

  if (AMBIGUOUS_PATTERNS.some((pattern) => pattern.test(rawText))) {
    return {
      kind: "ambiguous",
      rawText,
      reason: "This message looks like an instruction to the assistant, but it was not explicitly addressed."
    };
  }

  return {
    kind: "peer",
    rawText,
    body: rawText
  };
}

function stripAssistantAddress(rawText: string, assistantAddress: string): string | null {
  const escaped = escapeRegExp(assistantAddress.trim());
  const pattern = new RegExp(`^${escaped}(?:[\\s,:：，-]+)(.*)$`, "u");
  const match = rawText.match(pattern);

  if (!match) {
    return null;
  }

  return match[1]?.trim() ?? "";
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

