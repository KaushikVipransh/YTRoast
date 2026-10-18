export type QuickErrorCode = "denied" | "popup_closed" | "no-channel" | "forbidden" | "network" | "no-client-id";

/** Specific, a little funny, always with a way forward (design 5.11). */
export function quickErrorMessage(code: QuickErrorCode): string {
  switch (code) {
    case "denied":
    case "popup_closed":
      return "you blinked. we need read-only YouTube access to roast you.";
    case "no-channel":
      return "this google account has no youtube channel. sign in with the one you actually watch on.";
    case "forbidden":
    case "network":
      return "youtube said no. try again in a bit, or do the full roast with your takeout file.";
    case "no-client-id":
      return "quick roast isn't set up yet. use the full roast.";
  }
}
