import { SiteNav } from "@/components/SiteNav";
import { LinkButton } from "@/components/zine/Button";
import { CrumpledPaper } from "@/components/zine/illustrations";

/** Design 5.9: a crumpled paper ball for burned (deleted) files. */
export function BurnedView() {
  return (
    <main className="flex-1">
      <SiteNav />
      <div className="mx-auto flex max-w-xl flex-col items-start gap-6 px-4 py-12">
        <CrumpledPaper className="w-40" />
        <h1 className="display display-l">this file was burned.</h1>
        <p className="text-lg">whoever made it deleted the evidence. smart.</p>
        <LinkButton variant="primary" href="/roast">
          roast me
        </LinkButton>
      </div>
    </main>
  );
}
