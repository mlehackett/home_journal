// ── CONFIG ────────────────────────────────────────────────────────────────────
// Defaults for Home Journal. Override via window.APP_CONFIG before this loads.
const APP_CONFIG = window.APP_CONFIG ?? {
  appName:       "Home Journal",
  storagePrefix: "",
  tabs: [
    { id: "wildlife", type: "wildlife"  },
    { id: "log",      type: "chores"   },
    { id: "diary",    type: "freeform", sheetName: "Diary", placeholder: "What's on your mind?" },
    { id: "settings", type: "settings" }
  ]
};

const _pfx            = APP_CONFIG.storagePrefix;
const STORAGE_USER    = _pfx ? `${_pfx}_defaultUser`  : "default_user";
const STORAGE_SHEET_URL = _pfx ? `${_pfx}_url` : "spreadsheet_url";

const QUANTITY_CHORES = ["bags of salt"]; // lowercase - matched case-insensitively

let currentUser = "MLE";
let choreList   = []; // [{name, isQty, qty, histOpen}]
let speciesList = []; // [{name, histOpen}]

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const storedDefault = localStorage.getItem(STORAGE_USER);
  if (storedDefault) currentUser = storedDefault;

  if (isSignedIn()) {
    showApp();
  } else {
    document.getElementById("setup-screen").classList.add("visible");
  }
});

async function showApp() {
  document.getElementById("setup-screen").classList.remove("visible");
  document.getElementById("main-app").classList.add("visible");

  document.querySelectorAll(".user-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.user === currentUser));

  const url = localStorage.getItem(STORAGE_SHEET_URL) || "";
  const linkEl = document.getElementById("s-sheet-url");
  if (linkEl) {
    linkEl.href        = url;
    linkEl.textContent = url ? "Open spreadsheet" : "Not yet created";
  }
  const defUserEl = document.getElementById("s-default-user");
  if (defUserEl) defUserEl.value = currentUser;

  // Load each tab according to its type
  const loads = APP_CONFIG.tabs
    .filter(t => t.type === "chores")
    .map(() => loadChores());
  APP_CONFIG.tabs
    .filter(t => t.type === "wildlife")
    .forEach(() => loads.push(loadSpecies()));

  await Promise.all(loads);
}

// ── SETUP / AUTH ──────────────────────────────────────────────────────────────
async function signIn() {
  const btn = document.getElementById("signin-btn");
  const err = document.getElementById("setup-error");
  btn.disabled = true;
  btn.textContent = "Signing in…";
  err.classList.remove("visible");

  try {
    const defaultUser = document.getElementById("setup-default-user").value;
    localStorage.setItem(STORAGE_USER, defaultUser);
    currentUser = defaultUser;

    await getAccessToken();
    await getOrCreateSpreadsheet();
    showApp();
  } catch (e) {
    err.textContent = e.message;
    err.classList.add("visible");
    btn.disabled = false;
    btn.textContent = "Sign in with Google";
  }
}

function handleSignOut() {
  signOut();
  document.getElementById("main-app").classList.remove("visible");
  document.getElementById("setup-screen").classList.add("visible");
  choreList   = [];
  speciesList = [];
}

// ── USER & TABS ───────────────────────────────────────────────────────────────
function setUser(u) {
  currentUser = u;
  document.querySelectorAll(".user-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.user === u));
}

function showTab(name, e) {
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + name).classList.add("active");
  if (e && e.currentTarget) e.currentTarget.classList.add("active");
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function saveSettings() {
  const defaultUser = document.getElementById("s-default-user").value;
  localStorage.setItem(STORAGE_USER, defaultUser);
  currentUser = defaultUser;
  document.querySelectorAll(".user-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.user === currentUser));
  // Show confirmation on whichever status indicator is available
  const dotEl  = document.getElementById("status-dot")  || document.getElementById("trips-status-dot");
  const textEl = document.getElementById("status-text") || document.getElementById("trips-status-text");
  if (dotEl)  dotEl.className    = "status-dot ok";
  if (textEl) textEl.textContent = "Settings saved.";
}

// ═══════════════════════════════════════════════════════════════════════════════
// FREEFORM TABS  (Diary / Trips / Maintenance — any tab with type:"freeform")
// ═══════════════════════════════════════════════════════════════════════════════

// Called from HTML: submitFreeformEntry('diary') / submitFreeformEntry('trips') etc.
async function submitFreeformEntry(tabId) {
  const tabCfg   = APP_CONFIG.tabs.find(t => t.id === tabId);
  const sheetName = tabCfg ? tabCfg.sheetName : _capitalise(tabId);

  const textarea = document.getElementById(tabId + "-text");
  const text     = textarea.value.trim();
  if (!text) return;

  _setTabStatus(tabId, "loading", "Saving entry…");
  try {
    await _appendFreeformRow(sheetName, currentUser, text);
    textarea.value = "";
    _setTabStatus(tabId, "ok", "Entry saved!");
    // Reload list if it's already been opened
    const list = document.getElementById(tabId + "-list");
    if (list && list.children.length > 0) loadFreeformEntries(tabId);
  } catch (e) {
    _setTabStatus(tabId, "error", "Failed to save: " + e.message);
  }
}

// Called from HTML: loadFreeformEntries('diary') / loadFreeformEntries('trips') etc.
async function loadFreeformEntries(tabId) {
  const tabCfg    = APP_CONFIG.tabs.find(t => t.id === tabId);
  const sheetName = tabCfg ? tabCfg.sheetName : _capitalise(tabId);

  const btn  = document.getElementById(tabId + "-refresh-btn");
  if (btn) btn.textContent = "↺ Loading…";
  _setTabStatus(tabId, "loading", "Loading entries…");

  try {
    const rows = await _readFreeformRows(sheetName);
    const list = document.getElementById(tabId + "-list");

    if (rows.length === 0) {
      list.innerHTML = `<div class="empty-state">No entries yet.</div>`;
      _setTabStatus(tabId, "ok", "No entries yet.");
      return;
    }

    list.innerHTML = rows.map((row, idx) => {
      const [ts, user, entry] = row;
      const preview = (entry || "").substring(0, 60) + ((entry || "").length > 60 ? "…" : "");
      return `
        <div class="diary-entry" id="${tabId}-entry-${idx}">
          <div class="diary-entry-header" onclick="toggleFreeformEntry('${tabId}', ${idx})">
            <div class="diary-entry-meta">
              <span class="diary-entry-date">${ts || ""}</span>
              ${user ? `<span class="hist-user">${user}</span>` : ""}
            </div>
            <span class="diary-entry-preview" id="${tabId}-preview-${idx}">${preview}</span>
            <span class="diary-chevron" id="${tabId}-chevron-${idx}">›</span>
          </div>
          <div class="diary-entry-body" id="${tabId}-body-${idx}">${(entry || "").replace(/\n/g, "<br>")}</div>
        </div>`;
    }).join("");

    _setTabStatus(tabId, "ok", `${rows.length} entr${rows.length !== 1 ? "ies" : "y"} loaded.`);
  } catch (e) {
    _setTabStatus(tabId, "error", "Failed to load: " + e.message);
  } finally {
    if (btn) btn.textContent = "↺ Refresh entries";
  }
}

function toggleFreeformEntry(tabId, idx) {
  const body    = document.getElementById(`${tabId}-body-${idx}`);
  const chevron = document.getElementById(`${tabId}-chevron-${idx}`);
  const preview = document.getElementById(`${tabId}-preview-${idx}`);
  const open    = body.classList.toggle("open");
  chevron.style.transform = open ? "rotate(90deg)" : "";
  preview.style.display   = open ? "none" : "";
}

// Internal: append a row to any sheet with columns [Timestamp, User, Entry]
async function _appendFreeformRow(sheetName, user, entry) {
  const id    = await getOrCreateSpreadsheet();
  const token = await getAccessToken();
  const ts    = _timestamp();
  const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
  const res = await fetch(
    `${SHEETS_API}/${id}/values/${encodeURIComponent(sheetName)}!A:C:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[ts, user, entry]] })
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets API HTTP ${res.status}`);
  }
  return res.json();
}

// Internal: read all data rows (skipping header) from any sheet
async function _readFreeformRows(sheetName) {
  const id    = await getOrCreateSpreadsheet();
  const token = await getAccessToken();
  const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
  const res = await fetch(
    `${SHEETS_API}/${id}/values/${encodeURIComponent(sheetName)}!A2:C`,
    { headers: { "Authorization": `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets API HTTP ${res.status}`);
  }
  const data = await res.json();
  // Return most-recent-first
  return (data.values || []).reverse();
}

// ── Backward-compat wrappers so index.html onclick="submitDiaryEntry()" still works ──
function submitDiaryEntry()  { return submitFreeformEntry("diary"); }
function loadDiaryEntries()  { return loadFreeformEntries("diary"); }
function toggleDiaryEntry(i) { return toggleFreeformEntry("diary", i); }

// ═══════════════════════════════════════════════════════════════════════════════
// CHORES
// ═══════════════════════════════════════════════════════════════════════════════

async function loadChores() {
  setChoreStatus("loading", "Loading chores…");
  try {
    const names = await getUniqueChores();
    choreList = names.map(name => ({
      name,
      isQty: QUANTITY_CHORES.includes(name.toLowerCase()),
      qty: 3,
      histOpen: false
    }));
    setChoreStatus("ok", choreList.length === 0
      ? "No chores yet — add one below!"
      : `${choreList.length} chore${choreList.length !== 1 ? "s" : ""} loaded.`);
    renderChores();
  } catch (e) {
    setChoreStatus("error", "Could not load chores: " + e.message);
  }
}

function renderChores() {
  const grid = document.getElementById("chore-grid");
  grid.innerHTML = "";
  if (choreList.length === 0) {
    grid.innerHTML = `<div class="empty-state">No chores yet — add one below!</div>`;
    return;
  }
  choreList.forEach((chore, i) => {
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
          <div class="chore-name">${chore.name}</div>
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
  choreList[i].qty = Math.max(1, choreList[i].qty + delta);
  document.getElementById(`chore-qty-${i}`).textContent = choreList[i].qty;
}

async function logChore(i) {
  const chore = choreList[i];
  const card  = document.getElementById(`chore-card-${i}`);
  if (card.classList.contains("logging")) return;
  card.classList.add("logging");
  const quantity = chore.isQty ? chore.qty : 1;
  try {
    await appendChore(currentUser, chore.name, quantity);
    card.classList.remove("logging");
    card.classList.add("success");
    setChoreStatus("ok", `Logged: ${chore.name} (${quantity}) by ${currentUser}`);
    setTimeout(() => card.classList.remove("success"), 2000);
    if (chore.histOpen) fetchChoreHistory(i);
  } catch (e) {
    card.classList.remove("logging");
    setChoreStatus("error", "Failed to log: " + e.message);
  }
}

function toggleChoreHistory(i) {
  const chore = choreList[i];
  const panel = document.getElementById(`chore-hist-${i}`);
  const btn   = document.getElementById(`chore-histbtn-${i}`);
  chore.histOpen = !chore.histOpen;
  panel.classList.toggle("open", chore.histOpen);
  btn.classList.toggle("open", chore.histOpen);
  if (chore.histOpen) fetchChoreHistory(i);
}

async function fetchChoreHistory(i) {
  const chore = choreList[i];
  const panel = document.getElementById(`chore-hist-${i}`);
  panel.innerHTML = `<div class="hist-loading"><span class="spin">↺</span>&nbsp;Loading…</div>`;
  try {
    const all  = await readChores();
    const rows = all.filter(r => r.chore === chore.name);
    if (rows.length === 0) { panel.innerHTML = `<div class="hist-empty">No entries yet.</div>`; return; }
    panel.innerHTML = rows.map(r => `
      <div class="hist-item">
        <div class="hist-dot"></div>
        <div class="hist-date">${formatTimestamp(r.timestamp)}</div>
        ${r.user ? `<span class="hist-user">${r.user}</span>` : ""}
        <span class="hist-val">${r.quantity}</span>
      </div>`).join("");
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
  setChoreStatus("loading", `Logging "${name}"…`);
  try {
    await appendChore(currentUser, name, 1);
    setChoreStatus("ok", `Logged: ${name} by ${currentUser}. Refreshing…`);
    input.value = "";
    await loadChores();
  } catch (e) {
    setChoreStatus("error", "Error: " + e.message);
  } finally {
    submit.disabled = false; submit.textContent = "Log It";
  }
}

function setChoreStatus(state, msg) {
  const dot  = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  if (dot)  dot.className    = "status-dot " + state;
  if (text) text.textContent = msg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WILDLIFE
// ═══════════════════════════════════════════════════════════════════════════════

async function loadSpecies() {
  setWildlifeStatus("loading", "Loading species…");
  try {
    const names = await getUniqueSpecies();
    speciesList = names.map(name => ({ name, histOpen: false }));
    setWildlifeStatus("ok", speciesList.length === 0
      ? "No species yet — add one below!"
      : `${speciesList.length} species loaded.`);
    renderWildlife();
  } catch (e) {
    setWildlifeStatus("error", "Could not load species: " + e.message);
  }
}

function renderWildlife() {
  const grid = document.getElementById("wildlife-grid");
  grid.innerHTML = "";
  if (speciesList.length === 0) {
    grid.innerHTML = `<div class="empty-state">No species yet — add one below!</div>`;
    return;
  }
  speciesList.forEach((species, i) => {
    const card = document.createElement("div");
    card.className = "chore-card";
    card.id = `wildlife-card-${i}`;
    card.innerHTML = `
      <div class="chore-row">
        <div style="flex:1;cursor:pointer" onclick="logWildlife(${i})">
          <div class="chore-name">${species.name}</div>
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
  const species = speciesList[i];
  const card    = document.getElementById(`wildlife-card-${i}`);
  if (card.classList.contains("logging")) return;
  card.classList.add("logging");
  try {
    await appendWildlife(currentUser, species.name);
    card.classList.remove("logging");
    card.classList.add("success");
    setWildlifeStatus("ok", `Logged: ${species.name} by ${currentUser}`);
    setTimeout(() => card.classList.remove("success"), 2000);
    if (species.histOpen) fetchWildlifeHistory(i);
  } catch (e) {
    card.classList.remove("logging");
    setWildlifeStatus("error", "Failed to log: " + e.message);
  }
}

function toggleWildlifeHistory(i) {
  const species = speciesList[i];
  const panel   = document.getElementById(`wildlife-hist-${i}`);
  const btn     = document.getElementById(`wildlife-histbtn-${i}`);
  species.histOpen = !species.histOpen;
  panel.classList.toggle("open", species.histOpen);
  btn.classList.toggle("open", species.histOpen);
  if (species.histOpen) fetchWildlifeHistory(i);
}

async function fetchWildlifeHistory(i) {
  const species = speciesList[i];
  const panel   = document.getElementById(`wildlife-hist-${i}`);
  panel.innerHTML = `<div class="hist-loading"><span class="spin">↺</span>&nbsp;Loading…</div>`;
  try {
    const all  = await readWildlife();
    const rows = all.filter(r => r.species === species.name);
    if (rows.length === 0) { panel.innerHTML = `<div class="hist-empty">No sightings yet.</div>`; return; }

    const byDay = {};
    rows.forEach(r => {
      const day = r.timestamp.split(",")[0].trim();
      if (!byDay[day]) byDay[day] = { count: 0, users: new Set(), raw: r.timestamp };
      byDay[day].count++;
      if (r.user) byDay[day].users.add(r.user);
    });

    panel.innerHTML = Object.entries(byDay).map(([day, info]) => {
      const badges = [...info.users].map(u => `<span class="hist-user">${u}</span>`).join(" ");
      return `<div class="hist-item">
        <div class="hist-dot"></div>
        <div class="hist-date">${day}</div>
        ${badges}
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
  setWildlifeStatus("loading", `Logging "${name}"…`);
  try {
    await appendWildlife(currentUser, name);
    setWildlifeStatus("ok", `Logged: ${name} by ${currentUser}. Refreshing…`);
    input.value = "";
    await loadSpecies();
  } catch (e) {
    setWildlifeStatus("error", "Error: " + e.message);
  } finally {
    submit.disabled = false; submit.textContent = "Log It";
  }
}

function setWildlifeStatus(state, msg) {
  const dot  = document.getElementById("wildlife-status-dot");
  const text = document.getElementById("wildlife-status-text");
  if (dot)  dot.className    = "status-dot " + state;
  if (text) text.textContent = msg;
}

// ── SHARED HELPERS ────────────────────────────────────────────────────────────
function _timestamp() {
  return new Date().toLocaleString(undefined, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function _capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function _setTabStatus(tabId, state, msg) {
  const dot  = document.getElementById(tabId + "-status-dot");
  const text = document.getElementById(tabId + "-status-text");
  if (dot)  dot.className    = "status-dot " + state;
  if (text) text.textContent = msg;
}

function formatTimestamp(ts) {
  if (!ts) return "—";
  const d    = new Date(ts);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (isNaN(diff)) return ts;
  if (diff < 60)     return "Just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return ts.split(",")[0];
}
