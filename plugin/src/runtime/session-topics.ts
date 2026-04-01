export function buildPoolTopic(segment: string): string {
  return `pool:${segment}`;
}

export function buildShadowSessionTopic(sessionId: string): string {
  return `shadow-session:${sessionId}`;
}

