// ── CONFIG ────────────────────────────────────────────────────────────────────
const FEED_GROUP     = "home-chore-log";
const QUANTITY_FEEDS = ["bags_of_salt"]; // feeds that need a quantity input

let AIO_USERNAME = "";
let AIO_KEY      = "";
let AIO_BASE     = "";
let HEADERS      = {};

let currentUser = "MLE";
let choreFeeds  = [];

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const storedUser = localStorage.getItem("aio_username");
  const storedKey  = localStorage.getItem("aio_key");
  if (storedUser && storedKey) {
    initApp(storedUser, storedKey);
  } else {
    document.getElementById("setup-screen").classList.add("visible");
  }
});

function initApp(username, key) {
  AIO_USERNAME = username;
  AIO_KEY      = key;
  AIO_BASE     = `https://io.adafruit.com/api/v2/${AIO_USERNAME}`;
  HEADERS      = { "X-AIO-Key": AIO_KEY, "Content-Type": "application/json" };

  document.getElementById("setup-screen").classList.remove("visible");
  document.getElementById("main-app").classList.add("visible");
  document.getElementById("s-username").value = AIO_USERNAME;
  document.getElementById("s-apikey").value   = AIO_KEY;

  loadFeeds();
}

// ── SETUP ─────────────────────────────────────────────────────────────────────
function saveSetup() {
  const username = document.getElementById("setup-username").value.trim();
  const key      = document.getElementById("setup-key").value.trim();
  const err      = document.getElementById("setup-error");
  if (!username || !key) { err.classList.add("visible"); return; }
  err.classList.remove("visible");
  localStorage.setItem("aio_username", username);
  localStorage.setItem("aio_key", key);
  initApp(username, key);
}

function saveCredentials() {
  const username = document.getElementById("s-username").value.trim();
  const key      = document.getElementById("s-apikey").value.trim();
  if (!username || !key) return;
  localStorage.setItem("aio_username", username);
  localStorage.setItem("aio_key", key);
  initApp(username, key);
  setStatus("ok", "Credentials saved. Reloading feeds…");
}

// ── USER & TABS ───────────────────────────────────────────────────────────────
function setUser(u) {
  currentUser = u;
  document.querySelectorAll(".user-btn").forEach(b => b.classList.toggle("active", b.dataset.user === u));
}

function showTab(name, e) {
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + name).classList.add("active");
  if (e && e.currentTarget) e.currentTarget.classList.add("active");
}

// ── NAME HELPERS ──────────────────────────────────────────────────────────────
// Only first word capitalized: "bags_of_salt" → "Bags of salt"
function feedKeyToDisplay(key) {
  const words = key.split("_");
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

function displayToFeedKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

// ── VALUE ENCODING ────────────────────────────────────────────────────────────
// Values stored as "USER:quantity" e.g. "MLE:1" or "CYD:4"
function encodeValue(user, quantity) { return `${user}:${quantity}`; }

function decodeValue(raw) {
  if (!raw) return { user: "—", quantity: "?" };
  const colon = raw.indexOf(":");
  if (colon === -1) return { user: "—", quantity: raw };
  return { user: raw.substring(0, colon), quantity: raw.substring(colon + 1) };
}

// ── LOAD FEEDS ────────────────────────────────────────────────────────────────
async function loadFeeds() {
  setStatus("loading", "Loading chores from Adafruit IO…");
  try {
    const res = await fetch(`${AIO_BASE}/groups/${FEED_GROUP}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    choreFeeds = (data.feeds || []).map(f => {
      const shortKey = f.key.split(".").pop().replace(/-/g, "_");
      return { key: f.key, shortKey, displayName: feedKeyToDisplay(shortKey),
               isQty: QUANTITY_FEEDS.includes(shortKey), qty: 3, histOpen: false };
    });

    setStatus("ok", choreFeeds.length === 0
      ? "No feeds found yet. Add one below!"
      : `${choreFeeds.length} chore${choreFeeds.length !== 1 ? "s" : ""} loaded.`);
    renderChores();
  } catch (e) {
    setStatus("error", "Could not load feeds: " + e.message);
  }
}

// ── RENDER CHORES ─────────────────────────────────────────────────────────────
function renderChores() {
  const grid = document.getElementById("chore-grid");
  grid.innerHTML = "";

  if (choreFeeds.length === 0) {
    grid.innerHTML = `<div class="empty-state">No chores yet — add one below!</div>`;
    return;
  }

  choreFeeds.forEach((chore, i) => {
    const card = document.createElement("div");
    card.className = "chore-card";
    card.id = `card-${i}`;

    const qtyHtml = chore.isQty ? `
      <div class="qty-control" onclick="event.stopPropagation()">
        <button class="qty-btn" onclick="changeQty(${i},-1)">−</button>
        <span class="qty-val" id="qty-${i}">${chore.qty}</span>
        <button class="qty-btn" onclick="changeQty(${i},1)">+</button>
      </div>` : "";

    const tapHint = chore.isQty ? "Set qty, then tap ✓" : "Tap to log";

    card.innerHTML = `
      <div class="chore-row">
        <div style="flex:1;cursor:${chore.isQty ? "default" : "pointer"}" onclick="${chore.isQty ? "" : `logChore(${i})`}">
          <div class="chore-name">${chore.displayName}</div>
          <span class="chore-tap">${tapHint}</span>
        </div>
        <div class="chore-action">
          ${qtyHtml}
          <div class="log-icon" id="logbtn-${i}" onclick="logChore(${i})">✓</div>
          <div class="hist-toggle" id="histbtn-${i}" onclick="toggleHistory(${i})" title="History">≡</div>
        </div>
      </div>
      <div class="chore-history" id="hist-${i}"></div>`;

    grid.appendChild(card);
  });
}

// ── QTY CONTROL ───────────────────────────────────────────────────────────────
function changeQty(i, delta) {
  choreFeeds[i].qty = Math.max(1, choreFeeds[i].qty + delta);
  document.getElementById(`qty-${i}`).textContent = choreFeeds[i].qty;
}

// ── LOG CHORE ─────────────────────────────────────────────────────────────────
async function logChore(i) {
  const chore = choreFeeds[i];
  const card  = document.getElementById(`card-${i}`);
  if (card.classList.contains("logging")) return;

  card.classList.add("logging");
  const quantity = chore.isQty ? chore.qty : 1;
  const value    = encodeValue(currentUser, quantity);

  try {
    const res = await fetch(`${AIO_BASE}/feeds/${chore.key}/data`, {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ value })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    card.classList.remove("logging");
    card.classList.add("success");
    setStatus("ok", `Logged: ${chore.displayName} (${quantity}) by ${currentUser}`);
    setTimeout(() => card.classList.remove("success"), 2000);
    if (chore.histOpen) fetchHistory(i);
  } catch (e) {
    card.classList.remove("logging");
    setStatus("error", "Failed to log: " + e.message);
  }
}

// ── INLINE HISTORY ────────────────────────────────────────────────────────────
function toggleHistory(i) {
  const chore = choreFeeds[i];
  const panel = document.getElementById(`hist-${i}`);
  const btn   = document.getElementById(`histbtn-${i}`);
  chore.histOpen = !chore.histOpen;
  panel.classList.toggle("open", chore.histOpen);
  btn.classList.toggle("open", chore.histOpen);
  if (chore.histOpen) fetchHistory(i);
}

async function fetchHistory(i) {
  const chore = choreFeeds[i];
  const panel = document.getElementById(`hist-${i}`);
  panel.innerHTML = `<div class="hist-loading"><span class="spin">↺</span>&nbsp;Loading…</div>`;

  try {
    const res = await fetch(`${AIO_BASE}/feeds/${chore.key}/data?limit=15`, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();

    if (!items || items.length === 0) {
      panel.innerHTML = `<div class="hist-empty">No entries yet.</div>`;
      return;
    }

    panel.innerHTML = items.map(item => {
      const { user, quantity } = decodeValue(item.value);
      return `
        <div class="hist-item">
          <div class="hist-dot"></div>
          <div class="hist-date">${formatDate(new Date(item.created_at))}</div>
          ${user !== "—" ? `<span class="hist-user">${user}</span>` : ""}
          <span class="hist-val">${quantity}</span>
        </div>`;
    }).join("");
  } catch (e) {
    panel.innerHTML = `<div class="hist-empty">Error: ${e.message}</div>`;
  }
}

// ── LOG OTHER CHORE ───────────────────────────────────────────────────────────
async function logOther() {
  const input = document.getElementById("other-input");
  const name  = input.value.trim();
  if (!name) return;

  const submit = document.getElementById("other-submit");
  submit.disabled = true;
  submit.textContent = "…";

  const shortKey   = displayToFeedKey(name);
  const aioFeedKey = `${FEED_GROUP}.${shortKey.replace(/_/g, "-")}`;

  setStatus("loading", `Creating feed "${name}"…`);

  try {
    const createRes = await fetch(`${AIO_BASE}/groups/${FEED_GROUP}/feeds`, {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ feed: { name, key: shortKey.replace(/_/g, "-") } })
    });
    if (!createRes.ok && createRes.status !== 422)
      throw new Error(`Create feed HTTP ${createRes.status}`);

    const feedData    = createRes.ok ? await createRes.json() : null;
    const resolvedKey = feedData ? feedData.key : aioFeedKey;

    setStatus("loading", `Logging "${name}"…`);
    const logRes = await fetch(`${AIO_BASE}/feeds/${resolvedKey}/data`, {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ value: encodeValue(currentUser, 1) })
    });
    if (!logRes.ok) throw new Error(`Log HTTP ${logRes.status}`);

    setStatus("ok", `Logged: ${name} by ${currentUser}. Refreshing list…`);
    input.value = "";
    await loadFeeds();
  } catch (e) {
    setStatus("error", "Error: " + e.message);
  } finally {
    submit.disabled = false;
    submit.textContent = "Log It";
  }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function formatDate(d) {
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)     return "Just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function setStatus(state, msg) {
  document.getElementById("status-dot").className = "status-dot " + state;
  document.getElementById("status-text").textContent = msg;
}
