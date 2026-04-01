export type PresenceState = {
  profileId: string;
  locale: string;
  status: "live" | "idle";
  updatedAt: string;
};

export function buildPresenceState(profileId: string, locale: string): PresenceState {
  return {
    profileId,
    locale,
    status: "live",
    updatedAt: new Date().toISOString()
  };
}

