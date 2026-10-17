/** What the uploader says when POST /api/roast doesn't return 201. "try again" only where trying again can help. */
export function uploadErrorMessage(status: number): string {
  if (status === 400) return "we couldn't read the stats from that file. export your history again (json works best) and drop the new zip.";
  if (status === 429) return "you've been roasted 3 times today. come back tomorrow, you need the rest.";
  if (status === 413) return "your history is too big for us to roast in one go. export just the last few years and try that.";
  return "the roast oven jammed. try again.";
}
