// ── GOOGLE OAUTH ──────────────────────────────────────────────────────────────
// Uses redirect flow — redirects to Google, then back to this page.
// Token is extracted from the URL hash on return and stored in localStorage.

const GOOGLE_CLIENT_ID = "1042216799322-nejjr34u08ugkdkb5vdmqlk7mdsg7prd.apps.googleusercontent.com";
const GOOGLE_SCOPES    = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file";

let _accessToken    = null;
let _tokenExpiresAt = 0;

// ── INIT: CHECK FOR TOKEN IN URL HASH ON PAGE LOAD ────────────────────────────
// Call this early — if we're returning from Google, the token is in the hash.
(function extractTokenFromHash() {
  if (!window.location.hash) return;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token     = params.get("access_token");
  const expiresIn = parseInt(params.get("expires_in") || "0", 10);
  const state     = params.get("state");

  if (!token) return;

  // Validate state to prevent CSRF
  const savedState = sessionStorage.getItem("oauth_state");
  if (state && savedState && state !== savedState) {
    console.error("OAuth state mismatch");
    return;
  }
  sessionStorage.removeItem("oauth_state");

  const expiresAt = Date.now() + expiresIn * 1000;
  _accessToken    = token;
  _tokenExpiresAt = expiresAt;
  localStorage.setItem("google_token",         token);
  localStorage.setItem("google_token_expires", expiresAt.toString());

  // Clean the hash from the URL without reloading
  history.replaceState(null, "", window.location.pathname);
})();

// ── PUBLIC API ────────────────────────────────────────────────────────────────

async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiresAt - 60000) return _accessToken;
  const stored = _loadStoredToken();
  if (stored) return stored;
  // Need to redirect to Google — this won't return
  _redirectToGoogle();
  return new Promise(() => {}); // never resolves — page is redirecting
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

function _redirectToGoogle() {
  const state = Math.random().toString(36).substring(2);
  sessionStorage.setItem("oauth_state", state);

  const redirect = window.location.origin + window.location.pathname;
  const params   = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  redirect,
    response_type: "token",
    scope:         GOOGLE_SCOPES,
    state:         state,
    prompt:        "select_account"
  });

  window.location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
}
