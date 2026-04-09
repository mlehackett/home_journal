// ── GOOGLE OAUTH ──────────────────────────────────────────────────────────────
// Uses the implicit (token) flow — no client secret needed.
// Token is stored in localStorage and refreshed via re-prompt when expired.

const GOOGLE_CLIENT_ID = "1042216799322-nejjr34u08ugkdkb5vdmqlk7mdsg7prd.apps.googleusercontent.com";
const GOOGLE_SCOPES    = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file";

let _accessToken    = null;
let _tokenExpiresAt = 0;

// ── PUBLIC API ────────────────────────────────────────────────────────────────

// Returns a valid access token, prompting re-auth if needed.
// Throws if the user cancels.
async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiresAt - 60000) {
    return _accessToken;
  }
  // Try restoring from localStorage
  const stored = _loadStoredToken();
  if (stored) return stored;
  // Need to prompt
  return await _promptAuth();
}

function isSignedIn() {
  if (_accessToken && Date.now() < _tokenExpiresAt - 60000) return true;
  return !!_loadStoredToken();
}

function signOut() {
  _accessToken    = null;
  _tokenExpiresAt = 0;
  localStorage.removeItem("google_token");
  localStorage.removeItem("google_token_expires");
}

// ── INTERNAL ──────────────────────────────────────────────────────────────────

function _loadStoredToken() {
  const token   = localStorage.getItem("google_token");
  const expires = parseInt(localStorage.getItem("google_token_expires") || "0", 10);
  if (token && Date.now() < expires - 60000) {
    _accessToken    = token;
    _tokenExpiresAt = expires;
    return token;
  }
  return null;
}

function _promptAuth() {
  return new Promise((resolve, reject) => {
    const state    = Math.random().toString(36).substring(2);
    const redirect = window.location.origin + window.location.pathname;

    const params = new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID,
      redirect_uri:  redirect,
      response_type: "token",
      scope:         GOOGLE_SCOPES,
      state:         state,
      prompt:        "select_account"
    });

    const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();

    // Open popup
    const popup = window.open(authUrl, "google_auth", "width=500,height=600,left=200,top=100");
    if (!popup) { reject(new Error("Popup blocked — please allow popups for this site.")); return; }

    // Poll for redirect back
    const interval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(interval);
          reject(new Error("Auth cancelled."));
          return;
        }
        const url = popup.location.href;
        if (url.includes("access_token=")) {
          popup.close();
          clearInterval(interval);
          const hash   = popup.location.hash || url.split("#")[1] || "";
          const result = new URLSearchParams(hash.replace(/^#/, ""));
          const token  = result.get("access_token");
          const expiresIn = parseInt(result.get("expires_in") || "3600", 10);
          if (!token) { reject(new Error("No token in response.")); return; }
          const expiresAt = Date.now() + expiresIn * 1000;
          _accessToken    = token;
          _tokenExpiresAt = expiresAt;
          localStorage.setItem("google_token",         token);
          localStorage.setItem("google_token_expires", expiresAt.toString());
          resolve(token);
        }
      } catch (e) {
        // Cross-origin while redirecting — normal, keep polling
      }
    }, 200);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(interval);
      if (!popup.closed) popup.close();
      reject(new Error("Auth timed out."));
    }, 300000);
  });
}
