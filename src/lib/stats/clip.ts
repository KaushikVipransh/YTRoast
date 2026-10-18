const MAX_TEXT = 120;
// Byte cap per string keeps a whole Summary under ~30 KB even for CJK/emoji-heavy data.
const MAX_TEXT_BYTES = 160;

const utf8Bytes = (cp: number) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);

/** Truncates to ≤120 UTF-16 units and ≤160 UTF-8 bytes, ending in "…", never splitting a code point. */
export function clip(s: string): string {
  let units = 0;
  let bytes = 0;
  for (const ch of s) {
    units += ch.length;
    bytes += utf8Bytes(ch.codePointAt(0)!);
  }
  if (units <= MAX_TEXT && bytes <= MAX_TEXT_BYTES) return s;

  let out = "";
  units = 1; // room for "…"
  bytes = 3;
  for (const ch of s) {
    const b = utf8Bytes(ch.codePointAt(0)!);
    if (units + ch.length > MAX_TEXT || bytes + b > MAX_TEXT_BYTES) break;
    out += ch;
    units += ch.length;
    bytes += b;
  }
  return out + "…";
}
