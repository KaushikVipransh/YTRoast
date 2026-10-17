import type { TakeoutErrorCode } from "./types";

/** Specific, a little funny, and always ends with what to do next (PRD US-20, design §5.11). */
export function errorMessage(code: TakeoutErrorCode | "unknown", found: string[]): string {
  switch (code) {
    case "no-watch-history":
      return found[0]
        ? `that's not your watch history, that's ${found[0]}. we need watch-history.json. go back to step 4 of the guide and make sure "history" is ticked.`
        : `that's not your watch history. we need watch-history.json. go back to step 4 of the guide and make sure "history" is ticked.`;
    case "no-entries":
      return "your history is empty. either you're a saint or you turned history off. both are suspicious. turn watch history on, watch something embarrassing, and try again.";
    case "unreadable-zip":
      return "that zip is broken. it probably didn't finish downloading. download it again from google's email and drop the new one.";
    case "unreadable-history":
      return "that file is corrupted, or it isn't a takeout export. export your youtube history again and drop the fresh zip.";
    case "unsupported-archive":
      return "we can only read .zip files. export it again as .zip (it's the \"file type\" option in takeout).";
    case "unknown":
      return "something broke on our side, not yours. try again, and if it keeps happening, try the json version of your history.";
  }
}
