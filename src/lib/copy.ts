/** Must stay accurate: a summary with stats and some titles DOES go to the AI (PRD §9). Never say "nothing leaves your device". */
export const PRIVACY_LINE =
  "your full history stays on your device. a summary with stats and some video titles is sent to write your roast.";

/** Shown on every template roast (design §5.10): the AI was at capacity or couldn't answer. */
export function templateNotice(): string {
  return "too many people getting roasted right now. here's a quick one from your stats, come back later for the real thing.";
}
