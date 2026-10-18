// Google Identity Services token client (tech stack: no auth library, no server session). The access token
// lives only in memory in this tab, is used for a handful of read-only YouTube API calls, then revoked.

const GIS_SRC = "https://accounts.google.com/gsi/client";
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

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
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : reject(new Error("network")));
    script.onerror = () => {
      loading = undefined;
      reject(new Error("network"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Opens Google's consent popup; resolves with an access token or rejects with "denied" | "popup_closed" | "network". */
export async function requestToken(clientId: string): Promise<string> {
  const oauth2 = await loadGis();
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (response) => (response.access_token ? resolve(response.access_token) : reject(new Error("denied"))),
      error_callback: (error) => reject(new Error(error.type === "popup_closed" ? "popup_closed" : "denied")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

export function revokeToken(token: string): void {
  window.google?.accounts?.oauth2?.revoke(token);
}
