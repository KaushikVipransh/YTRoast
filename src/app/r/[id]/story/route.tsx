import { getDb } from "@/lib/db/client";
import { readOwnerToken } from "@/lib/roasts/ownership";
import { getRoastView } from "@/lib/roasts/service";
import { storyContent } from "@/lib/zine/story";
import { renderStory } from "@/lib/zine/story-image";

/**
 * 1080×1920 story image (design Part 6, PRD F18). Same visibility as the page: public roasts for anyone,
 * a private roast only for its owner (cookie); everyone else gets the same 404 as a missing roast.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getRoastView(await getDb(), id, readOwnerToken(req.headers.get("cookie"), id));
  if (view.kind !== "roast") return new Response("not found", { status: 404, headers: { "cache-control": "no-store" } });
  return renderStory(storyContent(view.roast, view.summary), id);
}
