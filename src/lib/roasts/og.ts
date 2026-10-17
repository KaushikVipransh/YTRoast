import type { RoastView } from "./service";

/** The headline a link preview may show: only for public roasts, never private, deleted or missing ones. */
export function ogHeadline(view: RoastView): string | null {
  return view.kind === "roast" && view.visibility === "public" ? view.roast.headline : null;
}
