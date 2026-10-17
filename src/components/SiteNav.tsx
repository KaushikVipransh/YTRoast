import Link from "next/link";

type Item = { href: string; label: string; key: "how" | "privacy" | "roast" };

const ITEMS: Item[] = [
  { href: "/#how-it-works", label: "how it works", key: "how" },
  { href: "/privacy", label: "privacy", key: "privacy" },
  { href: "/roast", label: "roast me", key: "roast" },
];

/** Condensed nav with ✦ markers; the current page is circled in marker (design Part 4 nav). */
export function SiteNav({ current }: { current?: Item["key"] }) {
  return (
    <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
      <Link href="/" className="label flex min-h-12 items-center gap-2 text-lg">
        <span aria-hidden="true">📼</span> caught watching
      </Link>
      <nav aria-label="main">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {ITEMS.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={current === item.key ? "page" : undefined}
                className={`label relative inline-flex min-h-12 items-center gap-1 px-1 ${current === item.key ? "after:absolute after:-inset-x-1 after:inset-y-2 after:rounded-[50%] after:border-[3px] after:border-marker after:-rotate-3" : ""}`}
              >
                <span aria-hidden="true">✦</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
