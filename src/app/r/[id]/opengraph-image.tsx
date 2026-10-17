import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db/client";
import { ogHeadline } from "@/lib/roasts/og";
import { getRoastView } from "@/lib/roasts/service";

export const alt = "Caught Watching";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#F6F4EE";
const SKY = "#5AA9D6";
const INK = "#1F2A44";
const MARKER = "#E2362B";

/** Long headlines shrink so they fit in two-ish lines. */
function fontSize(text: string): number {
  if (text.length <= 40) return 72;
  if (text.length <= 70) return 60;
  if (text.length <= 100) return 50;
  return 44;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Same rule as the page: only a public roast's headline may appear in a preview.
  const headline = ogHeadline(await getRoastView(await getDb(), id, null)) ?? "YOUR YOUTUBE HISTORY IS EVIDENCE.";
  const font = await readFile(join(process.cwd(), "src/assets/fonts/BowlbyOne-Regular.ttf"));

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: PAPER }}>
        <div style={{ display: "flex", width: 400, height: "100%", background: SKY, borderRight: `8px solid ${INK}` }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: 64 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              border: `6px solid ${MARKER}`,
              color: MARKER,
              padding: "8px 20px",
              fontSize: 32,
              transform: "rotate(-4deg)",
            }}
          >
            CAUGHT WATCHING
          </div>
          <div style={{ display: "flex", fontSize: fontSize(headline), color: INK, lineHeight: 1.05, textTransform: "uppercase" }}>
            {headline}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Bowlby One", data: font, style: "normal", weight: 400 }],
      // Never cache: a roast can be made private or deleted after its preview was fetched.
      headers: { "cache-control": "no-store" },
    },
  );
}
