import type { ReactNode } from "react";
import { SiteNav } from "@/components/SiteNav";
import { CONTACT_EMAIL } from "@/lib/copy";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="flex-1">
      <SiteNav current={title === "privacy" ? "privacy" : undefined} />
      <div className="mx-auto w-full max-w-2xl space-y-8 px-4 pb-16 pt-4 leading-relaxed">
        <header className="space-y-2">
          <h1 className="display display-l">{title}</h1>
          <p className="font-mono text-sm">last updated {updated}</p>
        </header>
        {children}
        {CONTACT_EMAIL && (
          <p>
            questions? email{" "}
            <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        )}
      </div>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-md border-[3px] border-ink bg-paper p-5 shadow-hard">
      <h2 className="label text-lg">{title}</h2>
      {children}
    </section>
  );
}
