import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/LegalPage";
import { PRODUCT_NAME } from "@/lib/copy";

export const metadata: Metadata = { title: `Terms · ${PRODUCT_NAME}` };

export default function TermsPage() {
  return (
    <LegalPage title="terms" updated="2026-10-18">
      <Section title="who can use this">
        <p>you must be at least 13 to use {PRODUCT_NAME} (google&apos;s minimum age for an account).</p>
      </Section>

      <Section title="what you're signing up for">
        <p>
          roasts are intentionally offensive. they joke about anything in your history, including health, breakups,
          politics and searches you&apos;d rather forget. if you don&apos;t want that, don&apos;t upload.
        </p>
        <p>roasts are written by AI from your stats. they can be wrong, unfair, or just not funny. they&apos;re jokes, not facts or advice.</p>
      </Section>

      <Section title="your data, your call">
        <p>
          only roast your own history. don&apos;t upload someone else&apos;s history without their permission. you
          decide whether a roast is shared, and you can make it private again or delete it at any time.
        </p>
      </Section>

      <Section title="fair use">
        <p>
          the site runs on free tiers, so there&apos;s a daily roast limit per person. don&apos;t try to get around it
          or abuse the service. we may remove roasts or block access to keep it running.
        </p>
        <p>{PRODUCT_NAME} is free, provided as is, and isn&apos;t affiliated with or endorsed by youtube or google.</p>
      </Section>
    </LegalPage>
  );
}
