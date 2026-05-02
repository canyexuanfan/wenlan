import {
  hasSupabaseCredentials,
  isMockModeForced,
  isSupabaseConfigured,
} from "./config";

export function getSupabaseConnectionState() {
  const forceMock = isMockModeForced();

  return {
    configured: isSupabaseConfigured(),
    credentialsPresent: hasSupabaseCredentials(),
    forceMock,
    mode: forceMock
      ? "forced-mock"
      : isSupabaseConfigured()
        ? "configured"
        : "mock-fallback",
  };
}
