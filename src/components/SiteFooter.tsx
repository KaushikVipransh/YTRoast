import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-4 py-8 font-mono text-sm">
      <nav aria-label="legal" className="flex gap-4">
        <Link href="/privacy" className="underline">
          privacy
        </Link>
        <Link href="/terms" className="underline">
          terms
        </Link>
      </nav>
    </footer>
  );
}
