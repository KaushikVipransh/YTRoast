/** Geometry for the hand-drawn 24-hour clock face (design 5.6 "The Clock"). Centered on (0, 0); 12am points up. */
export type ClockBar = { hour: number; path: string; late: boolean; tip: number };

const round = (n: number) => Math.round(n * 100) / 100;

export function clockBars(hours: number[], radius: { inner: number; outer: number }): ClockBar[] {
  const max = Math.max(0, ...hours);
  const slice = (2 * Math.PI) / 24;
  const half = (slice * 0.72) / 2;
  return Array.from({ length: 24 }, (_, hour) => {
    const count = hours[hour] ?? 0;
    const tip = round(radius.inner + (max > 0 ? (radius.outer - radius.inner) * (count / max) : 0));
    const center = hour * slice - Math.PI / 2;
    const point = (r: number, a: number) => `${round(r * Math.cos(a))} ${round(r * Math.sin(a))}`;
    // Outer-left, outer-right, inner-right, inner-left: a wedge from the inner ring out to the bar's tip.
    const path = `M${point(tip, center - half)} L${point(tip, center + half)} L${point(radius.inner, center + half)} L${point(radius.inner, center - half)} Z`;
    return { hour, path, late: hour < 5, tip };
  });
}
