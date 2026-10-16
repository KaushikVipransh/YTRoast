// All stats use the runtime's local time zone: the browser's, which is the user's.

const pad = (n: number) => String(n).padStart(2, "0");

/** "2024-03-05" in local time. */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2024-Q1" in local time. */
export function quarterKey(d: Date): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}
