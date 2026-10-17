import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/LegalPage";
import { PRIVACY_LINE, PRODUCT_NAME } from "@/lib/copy";

export const metadata: Metadata = { title: `Privacy · ${PRODUCT_NAME}` };

export default function PrivacyPage() {
  return (
    <LegalPage title="privacy" updated="2026-10-18">
      <p className="font-bold">{PRIVACY_LINE}</p>

      <Section title="your history file">
        <p>
          you drop your google takeout file in your browser and it&apos;s read there, on your device. your full history
          never reaches our servers. we turn it into a summary: counts, top channels, some video titles and search
          terms, the times you watch. only that summary leaves your device.
        </p>
      </Section>

      <Section title="who sees the summary">
        <p>
          the summary is sent to an AI to write your roast. free AI providers (Google Gemini, Groq) may use what we send
          them to improve their models. if that isn&apos;t okay with you, don&apos;t upload.
        </p>
        <p>
          we store the summary and the roast so your link works. your roast is private until you share it: nobody else
          can open the link, and it doesn&apos;t show up in search engines even after you share it.
        </p>
      </Section>

      <Section title="deleting">
        <p>
          deleting a roast wipes it from our database immediately. the link then says the file was burned. ownership is
          a secret cookie in your browser (we only keep a scrambled copy of it), so save your secret link if you might
          clear cookies.
        </p>
      </Section>

      <Section title="what else we collect">
        <p>
          we count visits and clicks (like &quot;roast created&quot; or &quot;shared&quot;) to see what works. analytics
          never include what you watched: no titles, channels, searches or roast text. we also record app errors so we
          can fix them. to stop people draining our free AI quota, we keep a count of roasts per network address
          (scrambled, never the address itself) for up to two days.
        </p>
        <p>
          the services that run the site: vercel (hosting), supabase (database), upstash (rate limits), posthog
          (analytics) and sentry (error reports). analytics see page types like &quot;a roast page&quot;, never which
          roast, and keep no cookie. error reports have request data and links stripped before they&apos;re sent.
        </p>
      </Section>
    </LegalPage>
  );
}
