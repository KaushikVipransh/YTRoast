import { Parser } from "htmlparser2";
import type { ParseResult, SearchEntry, WatchEntry } from "./types";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Time with optional 12-hour suffix: "3:30:00 AM", "3:30:00 pm", "3:30:00 p.m.", "23:10:04".
const TIME = String.raw`(\d{1,2}):(\d{2}):(\d{2})(?: ?([ap])\.?m\.?)?`;
// "Mar 5, 2024, 3:30:00 AM IST" (en-US/en-CA) and "5 Sept 2024, 23:10:04 BST" / "5 Mar 2024, 3:30:00 pm IST" (en-GB/en-IN/en-AU).
const MONTH_FIRST = new RegExp(String.raw`^([a-z]{3})[a-z]*\.? (\d{1,2}), (\d{4}),? ${TIME}`, "i");
const DAY_FIRST = new RegExp(String.raw`^(\d{1,2}) ([a-z]{3})[a-z]*\.? (\d{4}),? ${TIME}`, "i");

/**
 * Parses Takeout's human-readable timestamp as wall-clock time in the runtime's local zone.
 * The zone abbreviation is ignored: the clock the user lived by is what matters for "3am" stats.
 */
export function parseTakeoutDate(s: string): Date | null {
  const text = s.replace(/[  ]/g, " ").trim();
  let month: string, day: string, rest: string[];

  const mf = MONTH_FIRST.exec(text);
  const df = mf ? null : DAY_FIRST.exec(text);
  if (mf) [month, day, ...rest] = mf.slice(1);
  else if (df) [day, month, ...rest] = df.slice(1);
  else return null;

  const mon = MONTHS.indexOf(month.toLowerCase());
  const [y, h, min, sec] = rest.slice(0, 4).map(Number);
  const meridiem = rest[4]?.toLowerCase();
  if (mon < 0) return null;

  let hour = h;
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    hour = (h % 12) + (meridiem === "p" ? 12 : 0);
  } else if (h > 23) {
    return null;
  }
  return new Date(y, mon, Number(day), hour, min, sec);
}

type Anchor = { href: string | null; text: string };
type Cell = { anchors: Anchor[]; lines: string[]; isAd: boolean };

/**
 * Streams Takeout's markup. Each entry is a div.outer-cell whose first div.content-cell holds
 * "<a>title</a><br><a>channel</a><br>date"; a later content-cell says "From Google Ads" for ads.
 * Streaming keeps memory flat on 100k+ entry exports, where building a DOM costs ~1 GB.
 */
function readCells(html: string): Cell[] {
  const cells: Cell[] = [];
  let divDepth = 0;
  let outerDepth = -1;
  let contentDepth = -1;
  let contentIndex = 0;
  let cell: Cell | null = null;
  let line = "";
  let anchor: Anchor | null = null;
  let captionText = "";

  const endLine = () => {
    if (cell && line.trim()) cell.lines.push(line.trim());
    line = "";
  };

  const parser = new Parser({
    onopentag(name, attrs) {
      if (name === "div") {
        divDepth++;
        const classes = (attrs.class ?? "").split(/\s+/);
        if (classes.includes("outer-cell") && !cell) {
          cell = { anchors: [], lines: [], isAd: false };
          outerDepth = divDepth;
          contentIndex = 0;
        } else if (cell && contentDepth < 0 && classes.includes("content-cell")) {
          contentDepth = divDepth;
          captionText = "";
        }
        return;
      }
      if (!cell || contentDepth < 0 || contentIndex !== 0) return;
      if (name === "br") endLine();
      else if (name === "a") anchor = { href: attrs.href ?? null, text: "" };
    },
    ontext(text) {
      if (!cell || contentDepth < 0) return;
      if (contentIndex === 0) {
        line += text;
        if (anchor) anchor.text += text;
      } else {
        captionText += text;
      }
    },
    onclosetag(name) {
      if (name === "a" && anchor && cell) {
        cell.anchors.push(anchor);
        anchor = null;
        return;
      }
      if (name !== "div") return;
      if (cell && divDepth === contentDepth) {
        if (contentIndex === 0) endLine();
        else if (captionText.includes("From Google Ads")) cell.isAd = true;
        contentDepth = -1;
        contentIndex++;
      } else if (cell && divDepth === outerDepth) {
        cells.push(cell);
        cell = null;
        outerDepth = -1;
      }
      divDepth--;
    },
  });
  parser.end(html);
  return cells;
}

function videoIdFrom(href: string | null): string | null {
  if (!href) return null;
  try {
    return new URL(href).searchParams.get("v");
  } catch {
    return null;
  }
}

function lastLineDate(cell: Cell): Date | null {
  return cell.lines.length ? parseTakeoutDate(cell.lines[cell.lines.length - 1]) : null;
}

export function parseWatchHtml(html: string): ParseResult<WatchEntry> {
  const entries: WatchEntry[] = [];
  let skipped = 0;
  for (const cell of readCells(html)) {
    const [titleLink, channelLink] = cell.anchors;
    const time = lastLineDate(cell);
    // No link means the video was removed or made private.
    if (cell.isAd || !titleLink || !time) {
      skipped++;
      continue;
    }
    entries.push({
      title: titleLink.text.trim(),
      videoId: videoIdFrom(titleLink.href),
      channel: channelLink?.text.trim() || null,
      time,
    });
  }
  return { entries, skipped };
}

export function parseSearchHtml(html: string): ParseResult<SearchEntry> {
  const entries: SearchEntry[] = [];
  let skipped = 0;
  for (const cell of readCells(html)) {
    const query = cell.anchors[0]?.text.trim() ?? "";
    const time = lastLineDate(cell);
    if (cell.isAd || !query || !time) {
      skipped++;
      continue;
    }
    entries.push({ query, time });
  }
  return { entries, skipped };
}
