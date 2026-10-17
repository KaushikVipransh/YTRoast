import { SiteNav } from "@/components/SiteNav";
import { LinkButton } from "@/components/zine/Button";
import { CrumpledPaper } from "@/components/zine/illustrations";

/** Design 5.9: a private roast and a missing one look exactly the same. */
export default function NotFound() {
  return (
    <main className="flex-1">
      <SiteNav />
      <div className="mx-auto flex max-w-xl flex-col items-start gap-6 px-4 py-12">
        <CrumpledPaper className="w-40" />
        <h1 className="display display-l">nothing here. or someone&apos;s hiding something.</h1>
        <LinkButton variant="primary" href="/roast">
          roast me
        </LinkButton>
      </div>
    </main>
  );
}
