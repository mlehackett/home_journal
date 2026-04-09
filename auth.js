// ── GOOGLE IDENTITY SERVICES (GIS) AUTH ───────────────────────────────────────
// Uses Google's modern token client — no redirect URI needed, no implicit flow.
// The GIS library is loaded via a script tag in index.html.

const GOOGLE_CLIENT_ID = "1042216799322-nejjr34u08ugkdkb5vdmqlk7mdsg7prd.apps.googleusercontent.com";
const GOOGLE_SCOPES    = "https://www.googleapis.com/auth/drive.file";

let _accessToken    = null;
let _tokenExpiresAt = 0;
let _tokenClient    = null;

// ── PUBLIC API ────────────────────────────────────────────────────────────────

// Returns a valid access token, prompting via GIS popup if needed.
function getAccessToken() {
  return new Promise((resolve, reject) => {
    // Return cached token if still valid
    if (_accessToken && Date.now() < _tokenExpiresAt - 60000) {
      resolve(_accessToken);
      return;
    }
    // Try localStorage
    const stored = _loadStoredToken();
    if (stored) { resolve(stored); return; }

    // Need to prompt via GIS
    _ensureTokenClient((err) => {
      if (err) { reject(err); return; }
      _tokenClient.callback = (response) => {
        if (response.error) { reject(new Error(response.error)); return; }
        const expiresAt = Date.now() + (response.expires_in * 1000);
        _accessToken    = response.access_token;
        _tokenExpiresAt = expiresAt;
        localStorage.setItem("google_token",         response.access_token);
        localStorage.setItem("google_token_expires", expiresAt.toString());
        resolve(response.access_token);
      };
      _tokenClient.requestAccessToken({ prompt: "select_account" });
    });
  });
}

function isSignedIn() {
  if (_accessToken && Date.now() < _tokenExpiresAt - 60000) return true;
  return !!_loadStoredToken();
}

function signOut() {
  if (_accessToken) {
    try { google.accounts.oauth2.revoke(_accessToken); } catch(e) {}
  }
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

function _ensureTokenClient(callback) {
  // Wait for GIS library to load
  const maxWait = 5000;
  const start   = Date.now();
  const check   = () => {
    if (typeof google !== "undefined" && google.accounts && google.accounts.oauth2) {
      if (!_tokenClient) {
        _tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope:     GOOGLE_SCOPES,
          callback:  () => {} // set per-call
        });
      }
      callback(null);
    } else if (Date.now() - start > maxWait) {
      callback(new Error("Google Identity Services failed to load."));
    } else {
      setTimeout(check, 100);
    }
  };
  check();
}
