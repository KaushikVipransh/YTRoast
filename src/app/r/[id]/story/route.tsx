import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db/client";
import { readOwnerToken } from "@/lib/roasts/ownership";
import { getRoastView } from "@/lib/roasts/service";
import { storyContent } from "@/lib/zine/story";

const PAPER = "#F6F4EE";
const INK = "#1F2A44";
const SKY = "#5AA9D6";
const BUTTER = "#F3D66B";
const TANGERINE = "#EE9A5C";
const MARKER = "#E2362B";

const fonts = Promise.all([
  readFile(join(process.cwd(), "src/assets/fonts/BowlbyOne-Regular.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/Barlow-SemiBold.ttf")),
]);

/**
 * 1080×1920 story image (design Part 6, PRD F18). Same visibility as the page: public roasts for anyone,
 * a private roast only for its owner (cookie); everyone else gets the same 404 as a missing roast.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getRoastView(await getDb(), id, readOwnerToken(req.headers.get("cookie"), id));
  if (view.kind !== "roast") return new Response("not found", { status: 404, headers: { "cache-control": "no-store" } });

  const story = storyContent(view.roast, view.summary);
  const [display, body] = await fonts;
  const strip = (i: number) => (i % 2 === 0 ? PAPER : BUTTER);

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: PAPER, padding: "250px 72px", fontFamily: "Barlow" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontFamily: "Bowlby One", fontSize: 30, color: INK, letterSpacing: 2 }}>CASE #{id.toUpperCase()}</div>
          <div style={{ display: "flex", border: `6px solid ${MARKER}`, color: MARKER, padding: "6px 18px", fontFamily: "Bowlby One", fontSize: 28, transform: "rotate(-5deg)" }}>
            CAUGHT WATCHING
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 40, fontFamily: "Bowlby One", fontSize: story.headlineSize, lineHeight: 1.12, color: SKY, textTransform: "uppercase", textShadow: `6px 6px 0 ${INK}` }}>
          {story.headline}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 60, gap: 34 }}>
          {story.lines.map((line, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                background: strip(i),
                borderTop: `5px solid ${INK}`,
                borderBottom: `5px solid ${INK}`,
                padding: "26px 34px",
                fontSize: 44,
                lineHeight: 1.25,
                color: INK,
                boxShadow: `8px 8px 0 ${INK}`,
                transform: `rotate(${i % 2 ? -1 : 1}deg)`,
              }}
            >
              {line}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", marginTop: "auto", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignSelf: "flex-start", background: TANGERINE, border: `5px solid ${INK}`, borderRadius: 14, padding: "14px 26px", fontFamily: "Bowlby One", fontSize: 44, color: INK, transform: "rotate(-3deg)", boxShadow: `0 0 0 8px white` }}>
              {story.personality}
            </div>
            <div style={{ display: "flex", fontSize: 34, color: INK }}>{story.stat}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignSelf: "center", marginTop: 48, background: "rgba(243,214,107,0.85)", padding: "12px 40px", fontSize: 38, color: INK, transform: "rotate(-2deg)" }}>
          ytroast.vercel.app
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: "Bowlby One", data: display, style: "normal", weight: 400 },
        { name: "Barlow", data: body, style: "normal", weight: 600 },
      ],
      headers: { "cache-control": "no-store" },
    },
  );
}
