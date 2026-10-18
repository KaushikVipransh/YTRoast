import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { getDb } from "@/lib/db/client";
import { ogHeadline } from "@/lib/roasts/og";
import { getRoastView } from "@/lib/roasts/service";

export const alt = "Caught Watching";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#F6F4EE";
const SKY = "#5AA9D6";
const BUTTER = "#F3D66B";
const TANGERINE = "#EE9A5C";
const LEAF = "#93C572";
const INK = "#1F2A44";
const MARKER = "#E2362B";

/** Long headlines shrink so they fit in a few lines. */
function fontSize(text: string): number {
  if (text.length <= 40) return 72;
  if (text.length <= 70) return 60;
  if (text.length <= 100) return 50;
  return 44;
}

function Sticker({ text, fill, rotate, style }: { text: string; fill: string; rotate: number; style: Record<string, string | number> }) {
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        background: fill,
        border: `5px solid ${INK}`,
        borderRadius: 10,
        padding: "6px 18px",
        fontSize: 30,
        color: INK,
        transform: `rotate(${rotate}deg)`,
        boxShadow: "0 0 0 6px white",
        ...style,
      }}
    >
      {text}
    </div>
  );
}

/** Link preview (design Part 6): a tease, never the full roast. Only public roasts show their headline. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // roast state changes at any time; never prerender or cache this image
  const { id } = await params;
  const headline = ogHeadline(await getRoastView(await getDb(), id, null)) ?? "YOUR YOUTUBE HISTORY IS EVIDENCE.";
  const font = await readFile(join(process.cwd(), "src/assets/fonts/BowlbyOne-Regular.ttf"));

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: PAPER, fontFamily: "Bowlby One" }}>
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 400,
            height: "100%",
            background: SKY,
            borderRight: `8px solid ${INK}`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* The VHS mascot */}
          <svg width="260" height="156" viewBox="0 0 200 120">
            <rect x="6" y="10" width="188" height="100" rx="8" fill={INK} />
            <rect x="26" y="20" width="148" height="34" rx="3" fill={PAPER} stroke={INK} strokeWidth="3" />
            <rect x="52" y="62" width="96" height="38" rx="5" fill="#E9E4D8" stroke={INK} strokeWidth="3" />
            <circle cx="76" cy="81" r="13" fill={PAPER} stroke={INK} strokeWidth="3" />
            <circle cx="124" cy="81" r="13" fill={PAPER} stroke={INK} strokeWidth="3" />
          </svg>
          <Sticker text="3AM???" fill={BUTTER} rotate={-8} style={{ top: 70, left: 40 }} />
          <Sticker text="BRO." fill={TANGERINE} rotate={7} style={{ bottom: 80, right: 50 }} />
        </div>
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
          <div style={{ display: "flex", fontSize: fontSize(headline), color: INK, lineHeight: 1.05, textTransform: "uppercase" }}>{headline}</div>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-end",
              background: LEAF,
              border: `5px solid ${INK}`,
              borderRadius: 999,
              padding: "6px 22px",
              fontSize: 24,
              color: INK,
            }}
          >
            read the whole file →
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
