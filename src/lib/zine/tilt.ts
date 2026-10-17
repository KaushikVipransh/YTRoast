/** A stable tilt in [-max, max] degrees (0.1° steps) derived from a seed, so server and client render the same angle. */
export function seededTilt(seed: string, max: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const steps = Math.round(max * 10);
  return ((h % (2 * steps + 1)) - steps) / 10;
}
