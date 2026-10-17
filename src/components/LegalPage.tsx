import type { ReactNode } from "react";
import { CONTACT_EMAIL } from "@/lib/copy";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-10 leading-relaxed">
      <h1 className="text-4xl font-black uppercase">{title}</h1>
      <p className="font-mono text-sm">last updated {updated}</p>
      {children}
      {CONTACT_EMAIL && (
        <p>
          questions? email <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      )}
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-black uppercase">{title}</h2>
      {children}
    </section>
  );
}
