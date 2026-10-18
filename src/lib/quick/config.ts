/** The quick path ships dark until the owner's Google OAuth client exists (testing mode, ≤100 test users). */
export function quickPathEnabled(): boolean {
  return process.env.NEXT_PUBLIC_QUICK_PATH_ENABLED === "1";
}

export function googleClientId(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || null;
}
