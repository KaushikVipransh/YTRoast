import { afterEach, expect, test, vi } from "vitest";
import { hashToken, newOwnerToken, ownerCookie, ownerCookieName, readOwnerToken, tokenMatches } from "@/lib/roasts/ownership";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("token is 43 url-safe chars and unique", () => {
  const a = newOwnerToken();
  expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(newOwnerToken()).not.toBe(a);
});

test("hash matching", () => {
  const t = newOwnerToken();
  expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
  expect(tokenMatches(t, hashToken(t))).toBe(true);
  expect(tokenMatches(newOwnerToken(), hashToken(t))).toBe(false);
  expect(tokenMatches(t, "abc")).toBe(false);
  expect(tokenMatches("", hashToken(t))).toBe(false);
});

test("cookie name and attributes", () => {
  expect(ownerCookieName("abc")).toBe("cw_o_abc");
  const c = ownerCookie("abc", "TOKEN");
  expect(c).toMatch(/^cw_o_abc=TOKEN; /);
  for (const part of ["HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=31536000"]) expect(c).toContain(part);
  expect(c).not.toContain("Secure");
  vi.stubEnv("NODE_ENV", "production");
  expect(ownerCookie("abc", "TOKEN")).toContain("; Secure");
});

test("reads the owner token for one roast from a cookie header", () => {
  expect(readOwnerToken("a=1; cw_o_abc=TOKEN; cw_o_xyz=OTHER", "abc")).toBe("TOKEN");
  expect(readOwnerToken("cw_o_abcd=NOPE", "abc")).toBeNull();
  expect(readOwnerToken(null, "abc")).toBeNull();
});
