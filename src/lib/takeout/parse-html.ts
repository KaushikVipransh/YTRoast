import { parseDocument } from "htmlparser2";
import { findAll, getAttributeValue, textContent } from "domutils";
import type { ChildNode, Element } from "domhandler";
import type { ParseResult, SearchEntry, WatchEntry } from "./types";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "Mar 5, 2024, 3:30:00 AM IST" (en-US) and "5 Sept 2024, 23:10:04 BST" (en-GB).
const US_DATE = /^([a-z]{3})[a-z]*\.? (\d{1,2}), (\d{4}),? (\d{1,2}):(\d{2}):(\d{2}) ?([ap]m)/i;
const GB_DATE = /^(\d{1,2}) ([a-z]{3})[a-z]*\.? (\d{4}),? (\d{1,2}):(\d{2}):(\d{2})/i;

/**
 * Parses Takeout's human-readable timestamp as wall-clock time in the runtime's local zone.
 * The zone abbreviation is ignored: the clock the user lived by is what matters for "3am" stats.
 */
export function parseTakeoutDate(s: string): Date | null {
  const text = s.replace(/[  ]/g, " ").trim();
  let y: number, mon: number, d: number, h: number, min: number, sec: number;

  const us = US_DATE.exec(text);
  const gb = us ? null : GB_DATE.exec(text);
  if (us) {
    mon = MONTHS.indexOf(us[1].toLowerCase());
    [d, y, h, min, sec] = [us[2], us[3], us[4], us[5], us[6]].map(Number);
    h = (h % 12) + (us[7].toLowerCase() === "pm" ? 12 : 0);
  } else if (gb) {
    mon = MONTHS.indexOf(gb[2].toLowerCase());
    [d, y, h, min, sec] = [gb[1], gb[3], gb[4], gb[5], gb[6]].map(Number);
  } else {
    return null;
  }
  if (mon < 0 || h > 23) return null;
  return new Date(y, mon, d, h, min, sec);
}

type Cell = { anchors: Element[]; lines: string[]; isAd: boolean };

function isElement(node: ChildNode): node is Element {
  return node.type === "tag";
}

function hasClass(el: Element, cls: string): boolean {
  return (getAttributeValue(el, "class") ?? "").split(/\s+/).includes(cls);
}

/** Each Takeout entry is an outer-cell; its first content-cell holds "<a>title</a><br><a>channel</a><br>date". */
function readCells(html: string): Cell[] {
  const doc = parseDocument(html);
  return findAll((el) => hasClass(el, "outer-cell"), doc.children).map((outer) => {
    const contentCells = findAll((el) => hasClass(el, "content-cell"), outer.children);
    const body = contentCells[0];
    const anchors: Element[] = [];
    const lines: string[] = [];
    let current = "";
    for (const node of body?.children ?? []) {
      if (isElement(node) && node.name === "br") {
        if (current.trim()) lines.push(current.trim());
        current = "";
      } else if (isElement(node) && node.name === "a") {
        anchors.push(node);
        current += textContent(node);
      } else {
        current += textContent(node);
      }
    }
    if (current.trim()) lines.push(current.trim());
    const isAd = contentCells.slice(1).some((c) => textContent(c).includes("From Google Ads"));
    return { anchors, lines, isAd };
  });
}

function videoIdFrom(href: string | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href).searchParams.get("v");
  } catch {
    return null;
  }
}

export function parseWatchHtml(html: string): ParseResult<WatchEntry> {
  const entries: WatchEntry[] = [];
  let skipped = 0;
  for (const cell of readCells(html)) {
    const [titleLink, channelLink] = cell.anchors;
    const time = cell.lines.length ? parseTakeoutDate(cell.lines[cell.lines.length - 1]) : null;
    // No link means the video was removed or made private.
    if (cell.isAd || !titleLink || !time) {
      skipped++;
      continue;
    }
    entries.push({
      title: textContent(titleLink).trim(),
      videoId: videoIdFrom(getAttributeValue(titleLink, "href")),
      channel: channelLink ? textContent(channelLink).trim() || null : null,
      time,
    });
  }
  return { entries, skipped };
}

export function parseSearchHtml(html: string): ParseResult<SearchEntry> {
  const entries: SearchEntry[] = [];
  let skipped = 0;
  for (const cell of readCells(html)) {
    const link = cell.anchors[0];
    const time = cell.lines.length ? parseTakeoutDate(cell.lines[cell.lines.length - 1]) : null;
    const query = link ? textContent(link).trim() : "";
    if (cell.isAd || !query || !time) {
      skipped++;
      continue;
    }
    entries.push({ query, time });
  }
  return { entries, skipped };
}
