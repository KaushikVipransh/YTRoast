import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Ownership without accounts: the creator's browser holds a secret token in an httpOnly cookie,
// the database only ever sees its SHA-256 hash.

const ONE_YEAR = 31_536_000;

export function newOwnerToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: string, hash: string): boolean {
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const ownerCookieName = (id: string) => `cw_o_${id}`;

export function ownerCookie(id: string, token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ownerCookieName(id)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ONE_YEAR}${secure}`;
}

export function readOwnerToken(cookieHeader: string | null, id: string): string | null {
  if (!cookieHeader) return null;
  const name = ownerCookieName(id);
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || null;
  }
  return null;
}
