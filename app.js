// ── CONFIG ────────────────────────────────────────────────────────────────────
const CHORE_GROUP    = "home-chore-log";
const WILDLIFE_GROUP = "home-wildlife-log";
const DIARY_FEED     = "home-chore-log.diary-entries";
const QUANTITY_FEEDS = ["bags_of_salt"];

let AIO_USERNAME = "";
let AIO_KEY      = "";
let AIO_BASE     = "";
let HEADERS      = {};

let currentUser   = "MLE";
let choreFeeds    = [];
let wildlifeFeeds = [];

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

  loadChoreFeeds();
  loadWildlifeFeeds();
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
  setChoreStatus("ok", "Credentials saved. Reloading…");
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
function feedKeyToDisplay(key) {
  const words = key.split("_");
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

function displayToFeedKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

// ── VALUE ENCODING ────────────────────────────────────────────────────────────
function encodeValue(user, quantity) { return `${user}:${quantity}`; }

function decodeValue(raw) {
  if (!raw) return { user: "—", quantity: "?" };
  const colon = raw.indexOf(":");
  if (colon === -1) return { user: "—", quantity: raw };
  return { user: raw.substring(0, colon), quantity: raw.substring(colon + 1) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHORES
// ═══════════════════════════════════════════════════════════════════════════════

async function loadChoreFeeds() {
  setChoreStatus("loading", "Loading chores from Adafruit IO…");
  try {
    const res = await fetch(`${AIO_BASE}/groups/${CHORE_GROUP}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const CHORE_EXCLUDE = ["diary_entries"];
    choreFeeds = (data.feeds || [])
      .filter(f => !CHORE_EXCLUDE.includes(f.key.split(".").pop().replace(/-/g, "_")))
      .map(f => {
        const shortKey = f.key.split(".").pop().replace(/-/g, "_");
        return { key: f.key, shortKey, displayName: feedKeyToDisplay(shortKey),
                 isQty: QUANTITY_FEEDS.includes(shortKey), qty: 3, histOpen: false };
      });

    setChoreStatus("ok", choreFeeds.length === 0
      ? "No feeds found yet. Add one below!"
      : `${choreFeeds.length} chore${choreFeeds.length !== 1 ? "s" : ""} loaded.`);
    renderChores();
  } catch (e) {
    setChoreStatus("error", "Could not load feeds: " + e.message);
  }
}

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
    card.id = `chore-card-${i}`;

    const qtyHtml = chore.isQty ? `
      <div class="qty-control" onclick="event.stopPropagation()">
        <button class="qty-btn" onclick="changeChoreQty(${i},-1)">−</button>
        <span class="qty-val" id="chore-qty-${i}">${chore.qty}</span>
        <button class="qty-btn" onclick="changeChoreQty(${i},1)">+</button>
      </div>` : "";

    card.innerHTML = `
      <div class="chore-row">
        <div style="flex:1;cursor:${chore.isQty ? "default" : "pointer"}" onclick="${chore.isQty ? "" : `logChore(${i})`}">
          <div class="chore-name">${chore.displayName}</div>
          <span class="chore-tap">${chore.isQty ? "Set qty, then tap ✓" : "Tap to log"}</span>
        </div>
        <div class="chore-action">
          ${qtyHtml}
          <div class="log-icon" onclick="logChore(${i})">✓</div>
          <div class="hist-toggle" id="chore-histbtn-${i}" onclick="toggleChoreHistory(${i})">≡</div>
        </div>
      </div>
      <div class="chore-history" id="chore-hist-${i}"></div>`;
    grid.appendChild(card);
  });
}

function changeChoreQty(i, delta) {
  choreFeeds[i].qty = Math.max(1, choreFeeds[i].qty + delta);
  document.getElementById(`chore-qty-${i}`).textContent = choreFeeds[i].qty;
}

async function logChore(i) {
  const chore = choreFeeds[i];
  const card  = document.getElementById(`chore-card-${i}`);
  if (card.classList.contains("logging")) return;
  card.classList.add("logging");
  const quantity = chore.isQty ? chore.qty : 1;
  try {
    const res = await fetch(`${AIO_BASE}/feeds/${chore.key}/data`, {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ value: encodeValue(currentUser, quantity) })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    card.classList.remove("logging");
    card.classList.add("success");
    setChoreStatus("ok", `Logged: ${chore.displayName} (${quantity}) by ${currentUser}`);
    setTimeout(() => card.classList.remove("success"), 2000);
    if (chore.histOpen) fetchChoreHistory(i);
  } catch (e) {
    card.classList.remove("logging");
    setChoreStatus("error", "Failed to log: " + e.message);
  }
}

function toggleChoreHistory(i) {
  const chore = choreFeeds[i];
  const panel = document.getElementById(`chore-hist-${i}`);
  const btn   = document.getElementById(`chore-histbtn-${i}`);
  chore.histOpen = !chore.histOpen;
  panel.classList.toggle("open", chore.histOpen);
  btn.classList.toggle("open", chore.histOpen);
  if (chore.histOpen) fetchChoreHistory(i);
}

async function fetchChoreHistory(i) {
  const chore = choreFeeds[i];
  const panel = document.getElementById(`chore-hist-${i}`);
  panel.innerHTML = `<div class="hist-loading"><span class="spin">↺</span>&nbsp;Loading…</div>`;
  try {
    const res = await fetch(`${AIO_BASE}/feeds/${chore.key}/data?limit=15`, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    if (!items || items.length === 0) { panel.innerHTML = `<div class="hist-empty">No entries yet.</div>`; return; }
    panel.innerHTML = items.map(item => {
      const { user, quantity } = decodeValue(item.value);
      return `<div class="hist-item">
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

async function logOtherChore() {
  const input  = document.getElementById("other-input");
  const submit = document.getElementById("other-submit");
  const name   = input.value.trim();
  if (!name) return;
  submit.disabled = true; submit.textContent = "…";
  const shortKey   = displayToFeedKey(name);
  const aioFeedKey = `${CHORE_GROUP}.${shortKey.replace(/_/g, "-")}`;
  setChoreStatus("loading", `Creating feed "${name}"…`);
  try {
    const createRes = await fetch(`${AIO_BASE}/groups/${CHORE_GROUP}/feeds`, {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ feed: { name, key: shortKey.replace(/_/g, "-") } })
    });
    if (!createRes.ok && createRes.status !== 422) throw new Error(`Create feed HTTP ${createRes.status}`);
    const feedData    = createRes.ok ? await createRes.json() : null;
    const resolvedKey = feedData ? feedData.key : aioFeedKey;
    const logRes = await fetch(`${AIO_BASE}/feeds/${resolvedKey}/data`, {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ value: encodeValue(currentUser, 1) })
    });
    if (!logRes.ok) throw new Error(`Log HTTP ${logRes.status}`);
    setChoreStatus("ok", `Logged: ${name} by ${currentUser}. Refreshing…`);
    input.value = "";
    await loadChoreFeeds();
  } catch (e) {
    setChoreStatus("error", "Error: " + e.message);
  } finally {
    submit.disabled = false; submit.textContent = "Log It";
  }
}

function setChoreStatus(state, msg) {
  document.getElementById("status-dot").className = "status-dot " + state;
  document.getElementById("status-text").textContent = msg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WILDLIFE
// ═══════════════════════════════════════════════════════════════════════════════

async function loadWildlifeFeeds() {
  setWildlifeStatus("loading", "Loading species from Adafruit IO…");
  try {
    const res = await fetch(`${AIO_BASE}/groups/${WILDLIFE_GROUP}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    wildlifeFeeds = (data.feeds || []).map(f => {
      const shortKey = f.key.split(".").pop().replace(/-/g, "_");
      return { key: f.key, shortKey, displayName: feedKeyToDisplay(shortKey), histOpen: false };
    });

    setWildlifeStatus("ok", wildlifeFeeds.length === 0
      ? "No species yet — add one below!"
      : `${wildlifeFeeds.length} species loaded.`);
    renderWildlife();
  } catch (e) {
    setWildlifeStatus("error", "Could not load feeds: " + e.message);
  }
}

function renderWildlife() {
  const grid = document.getElementById("wildlife-grid");
  grid.innerHTML = "";
  if (wildlifeFeeds.length === 0) {
    grid.innerHTML = `<div class="empty-state">No species yet — add one below!</div>`;
    return;
  }
  wildlifeFeeds.forEach((species, i) => {
    const card = document.createElement("div");
    card.className = "chore-card";
    card.id = `wildlife-card-${i}`;
    card.innerHTML = `
      <div class="chore-row">
        <div style="flex:1;cursor:pointer" onclick="logWildlife(${i})">
          <div class="chore-name">${species.displayName}</div>
          <span class="chore-tap">Tap to log sighting</span>
        </div>
        <div class="chore-action">
          <div class="log-icon" onclick="logWildlife(${i})">✓</div>
          <div class="hist-toggle" id="wildlife-histbtn-${i}" onclick="toggleWildlifeHistory(${i})">≡</div>
        </div>
      </div>
      <div class="chore-history" id="wildlife-hist-${i}"></div>`;
    grid.appendChild(card);
  });
}

async function logWildlife(i) {
  const species = wildlifeFeeds[i];
  const card    = document.getElementById(`wildlife-card-${i}`);
  if (card.classList.contains("logging")) return;
  card.classList.add("logging");
  try {
    const res = await fetch(`${AIO_BASE}/feeds/${species.key}/data`, {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ value: encodeValue(currentUser, 1) })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    card.classList.remove("logging");
    card.classList.add("success");
    setWildlifeStatus("ok", `Logged: ${species.displayName} by ${currentUser}`);
    setTimeout(() => card.classList.remove("success"), 2000);
    if (species.histOpen) fetchWildlifeHistory(i);
  } catch (e) {
    card.classList.remove("logging");
    setWildlifeStatus("error", "Failed to log: " + e.message);
  }
}

function toggleWildlifeHistory(i) {
  const species = wildlifeFeeds[i];
  const panel   = document.getElementById(`wildlife-hist-${i}`);
  const btn     = document.getElementById(`wildlife-histbtn-${i}`);
  species.histOpen = !species.histOpen;
  panel.classList.toggle("open", species.histOpen);
  btn.classList.toggle("open", species.histOpen);
  if (species.histOpen) fetchWildlifeHistory(i);
}

async function fetchWildlifeHistory(i) {
  const species = wildlifeFeeds[i];
  const panel   = document.getElementById(`wildlife-hist-${i}`);
  panel.innerHTML = `<div class="hist-loading"><span class="spin">↺</span>&nbsp;Loading…</div>`;
  try {
    const res = await fetch(`${AIO_BASE}/feeds/${species.key}/data?limit=100`, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    if (!items || items.length === 0) { panel.innerHTML = `<div class="hist-empty">No sightings yet.</div>`; return; }

    // Aggregate by day
    const byDay = {};
    items.forEach(item => {
      const d   = new Date(item.created_at);
      const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      if (!byDay[day]) byDay[day] = { count: 0, users: new Set(), date: d };
      const { user } = decodeValue(item.value);
      byDay[day].count++;
      if (user !== "—") byDay[day].users.add(user);
    });

    // Sort days newest first
    const days = Object.entries(byDay).sort((a, b) => b[1].date - a[1].date);

    panel.innerHTML = days.map(([day, info]) => {
      const userBadges = [...info.users].map(u => `<span class="hist-user">${u}</span>`).join(" ");
      return `<div class="hist-item">
        <div class="hist-dot"></div>
        <div class="hist-date">${day}</div>
        ${userBadges}
        <span class="hist-val">${info.count}×</span>
      </div>`;
    }).join("");
  } catch (e) {
    panel.innerHTML = `<div class="hist-empty">Error: ${e.message}</div>`;
  }
}

async function logOtherWildlife() {
  const input  = document.getElementById("wildlife-other-input");
  const submit = document.getElementById("wildlife-other-submit");
  const name   = input.value.trim();
  if (!name) return;
  submit.disabled = true; submit.textContent = "…";
  const shortKey   = displayToFeedKey(name);
  const aioFeedKey = `${WILDLIFE_GROUP}.${shortKey.replace(/_/g, "-")}`;
  setWildlifeStatus("loading", `Creating feed "${name}"…`);
  try {
    const createRes = await fetch(`${AIO_BASE}/groups/${WILDLIFE_GROUP}/feeds`, {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ feed: { name, key: shortKey.replace(/_/g, "-") } })
    });
    if (!createRes.ok && createRes.status !== 422) throw new Error(`Create feed HTTP ${createRes.status}`);
    const feedData    = createRes.ok ? await createRes.json() : null;
    const resolvedKey = feedData ? feedData.key : aioFeedKey;
    const logRes = await fetch(`${AIO_BASE}/feeds/${resolvedKey}/data`, {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ value: encodeValue(currentUser, 1) })
    });
    if (!logRes.ok) throw new Error(`Log HTTP ${logRes.status}`);
    setWildlifeStatus("ok", `Logged: ${name} by ${currentUser}. Refreshing…`);
    input.value = "";
    await loadWildlifeFeeds();
  } catch (e) {
    setWildlifeStatus("error", "Error: " + e.message);
  } finally {
    submit.disabled = false; submit.textContent = "Log It";
  }
}

function setWildlifeStatus(state, msg) {
  document.getElementById("wildlife-status-dot").className = "status-dot " + state;
  document.getElementById("wildlife-status-text").textContent = msg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIARY
// ═══════════════════════════════════════════════════════════════════════════════

async function submitDiaryEntry() {
  const textarea = document.getElementById("diary-text");
  const text     = textarea.value.trim();
  if (!text) return;

  setDiaryStatus("loading", "Saving entry…");
  try {
    // Store as "USER:text" — reuse same encoding convention
    const value = encodeValue(currentUser, text);
    const res = await fetch(`${AIO_BASE}/feeds/${DIARY_FEED}/data`, {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ value })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    textarea.value = "";
    setDiaryStatus("ok", "Entry saved!");
    // Refresh list if already loaded
    const list = document.getElementById("diary-list");
    if (list.children.length > 0) loadDiaryEntries();
  } catch (e) {
    setDiaryStatus("error", "Failed to save: " + e.message);
  }
}

async function loadDiaryEntries() {
  const btn = document.getElementById("diary-refresh-btn");
  btn.textContent = "↺ Loading…";
  setDiaryStatus("loading", "Loading entries…");
  try {
    const res = await fetch(`${AIO_BASE}/feeds/${DIARY_FEED}/data?limit=100`, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();

    const list = document.getElementById("diary-list");
    if (!items || items.length === 0) {
      list.innerHTML = `<div class="empty-state">No entries yet.</div>`;
      setDiaryStatus("ok", "No entries yet.");
      return;
    }

    list.innerHTML = items.map((item, idx) => {
      const { user, quantity: text } = decodeValue(item.value);
      const date = new Date(item.created_at);
      const dateStr = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      const timeStr = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return `
        <div class="diary-entry" id="diary-entry-${idx}">
          <div class="diary-entry-header" onclick="toggleDiaryEntry(${idx})">
            <div class="diary-entry-meta">
              <span class="diary-entry-date">${dateStr}, ${timeStr}</span>
              ${user !== "—" ? `<span class="hist-user">${user}</span>` : ""}
            </div>
            <span class="diary-entry-preview" id="diary-preview-${idx}">${text.substring(0, 60)}${text.length > 60 ? "…" : ""}</span>
            <span class="diary-chevron" id="diary-chevron-${idx}">›</span>
          </div>
          <div class="diary-entry-body" id="diary-body-${idx}">${text.replace(/\n/g, "<br>")}</div>
        </div>`;
    }).join("");

    setDiaryStatus("ok", `${items.length} entr${items.length !== 1 ? "ies" : "y"} loaded.`);
  } catch (e) {
    setDiaryStatus("error", "Failed to load: " + e.message);
  } finally {
    btn.textContent = "↺ Refresh entries";
  }
}

function toggleDiaryEntry(idx) {
  const body    = document.getElementById(`diary-body-${idx}`);
  const chevron = document.getElementById(`diary-chevron-${idx}`);
  const preview = document.getElementById(`diary-preview-${idx}`);
  const open    = body.classList.toggle("open");
  chevron.style.transform = open ? "rotate(90deg)" : "";
  preview.style.display   = open ? "none" : "";
}

function setDiaryStatus(state, msg) {
  document.getElementById("diary-status-dot").className = "status-dot " + state;
  document.getElementById("diary-status-text").textContent = msg;
}

// ── SHARED HELPERS ────────────────────────────────────────────────────────────
function formatDate(d) {
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)     return "Just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
