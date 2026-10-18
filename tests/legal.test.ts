import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import { PRIVACY_LINE } from "@/lib/copy";

const html = (el: React.ReactElement) =>
  renderToStaticMarkup(el).replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

test("privacy page states what goes where (PRD F23, §9)", () => {
  const page = html(PrivacyPage());
  for (const phrase of [
    PRIVACY_LINE,
    "your full history never reaches our servers",
    "free AI providers (Google Gemini, Groq) may use what we send them to improve their models",
    "private until you share it",
    "deleting a roast wipes it from our database immediately",
    "analytics never include what you watched",
    "for up to two days",
    "read-only youtube access",
    "the access token stays in your browser and is revoked as soon as your likes are read",
    "liked video titles, channel names, subscription names and playlist names",
    "vercel (hosting), supabase (database), upstash (rate limits), posthog (analytics) and sentry (error reports)",
  ]) {
    expect(page).toContain(phrase);
  }
  expect(page).not.toMatch(/nothing leaves your device/i);
});

test("terms page: 13+, offensive by design, consent (PRD F24)", () => {
  const page = html(TermsPage());
  for (const phrase of ["you must be at least 13", "intentionally offensive", "don't upload someone else's history without their permission"]) {
    expect(page).toContain(phrase);
  }
});
