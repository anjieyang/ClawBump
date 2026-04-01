export type CollisionOpenerInput = {
  sharedContext: string;
  differenceHint: string;
};

export function buildShadowIntro(summary: string): string {
  return `你碰到了一个新影子：${summary}`;
}

export function buildCollisionOpener(input: CollisionOpenerInput): string {
  return `先给你们一个轻一点的切口：${input.sharedContext}。有意思的是，你们在 ${input.differenceHint} 上可能不太一样，可以从这里慢慢聊开。`;
}

