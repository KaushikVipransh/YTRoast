// Google Identity Services token client (tech stack: no auth library, no server session). The access token
// lives only in memory in this tab, is used for a handful of read-only YouTube API calls, then revoked.
//
// Google's documented pattern: load GIS and create the token client ahead of time, then call
// requestAccessToken() synchronously inside the click handler. Opening the popup after an await
// (e.g. loading the script on click) gets it blocked by Safari/iOS as "not from a user gesture".

const GIS_SRC = "https://accounts.google.com/gsi/client";
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

export type TokenErrorCode = "denied" | "popup_closed" | "popup_blocked";

type TokenResponse = { access_token?: string; error?: string };
type GoogleOAuth = {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string }) => void;
  }): { requestAccessToken(options?: { prompt?: string }): void };
  revoke(token: string, done?: () => void): void;
};
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth } };
  }
}

let loading: Promise<GoogleOAuth> | undefined;

function loadGis(): Promise<GoogleOAuth> {
  loading ??= new Promise<GoogleOAuth>((resolve, reject) => {
    const fail = () => {
      loading = undefined; // let a later attempt retry instead of caching the failure
      reject(new Error("network"));
    };
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : fail());
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}

export type TokenClient = {
  /** Must be called synchronously from a click/tap handler. Resolves with an access token. */
  request(): Promise<string>;
};

/** Loads GIS and prepares a token client; call on mount, long before the user taps. */
export async function prepareTokenClient(clientId: string): Promise<TokenClient> {
  const oauth2 = await loadGis();
  let pending: { resolve: (token: string) => void; reject: (err: Error) => void } | null = null;
  const settle = (fn: (p: NonNullable<typeof pending>) => void) => {
    if (pending) fn(pending);
    pending = null;
  };
  const client = oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: (response) =>
      settle((p) => (response.access_token ? p.resolve(response.access_token) : p.reject(new Error("denied")))),
    error_callback: (error) =>
      settle((p) =>
        p.reject(new Error(error.type === "popup_failed_to_open" ? "popup_blocked" : error.type === "popup_closed" ? "popup_closed" : "denied")),
      ),
  });
  return {
    request() {
      const token = new Promise<string>((resolve, reject) => {
        pending = { resolve, reject };
      });
      client.requestAccessToken({ prompt: "" });
      return token;
    },
  };
}

export function revokeToken(token: string): void {
  window.google?.accounts?.oauth2?.revoke(token);
}
