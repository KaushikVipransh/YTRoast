export type QuickErrorCode = "denied" | "popup_closed" | "popup_blocked" | "no-channel" | "forbidden" | "network" | "no-client-id";

/** Specific, a little funny, always with a way forward (design 5.11). */
export function quickErrorMessage(code: QuickErrorCode): string {
  switch (code) {
    case "denied":
    case "popup_closed":
      return "you blinked. we need read-only YouTube access to roast you.";
    case "popup_blocked":
      return "your browser blocked google's sign-in popup. allow popups for this site and tap again.";
    case "no-channel":
      return "this google account has no youtube channel. sign in with the one you actually watch on.";
    case "forbidden":
    case "network":
      return "youtube said no. try again in a bit, or do the full roast with your takeout file.";
    case "no-client-id":
      return "quick roast isn't set up yet. use the full roast.";
  }
}

/** What the quick roaster says when /api/roast doesn't return 201: there is no file to re-export here. */
export function quickServerMessage(status: number): string {
  if (status === 400) return "something in your youtube data confused us. try again, or do the full roast.";
  if (status === 413) return "your account is too big to roast in one go. do the full roast instead.";
  if (status === 429) return "you've been roasted 3 times today. come back tomorrow, you need the rest.";
  return "the roast oven jammed. try again.";
}
