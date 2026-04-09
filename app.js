// ── CONFIG ────────────────────────────────────────────────────────────────────
const QUANTITY_CHORES = ["Bags of salt"]; // display names that need a qty input

let currentUser = "MLE";
let choreList   = []; // [{name, isQty, qty, histOpen}]
let speciesList = []; // [{name, histOpen}]

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Restore default user
  const storedDefault = localStorage.getItem("default_user");
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

  // Reflect current user in header
  document.querySelectorAll(".user-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.user === currentUser));

  // Populate settings
  const url = localStorage.getItem("spreadsheet_url") || "";
  document.getElementById("s-sheet-url").href        = url;
  document.getElementById("s-sheet-url").textContent = url ? "Open spreadsheet" : "Not yet created";
  document.getElementById("s-default-user").value    = currentUser;

  await Promise.all([loadChores(), loadSpecies()]);
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
    localStorage.setItem("default_user", defaultUser);
    currentUser = defaultUser;

    await getAccessToken();
    // Trigger spreadsheet creation on first sign-in
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
  localStorage.setItem("default_user", defaultUser);
  currentUser = defaultUser;
  document.querySelectorAll(".user-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.user === currentUser));
  setChoreStatus("ok", "Settings saved.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHORES
// ═══════════════════════════════════════════════════════════════════════════════

async function loadChores() {
  setChoreStatus("loading", "Loading chores…");
  try {
    const names = await getUniqueChores();
    choreList = names.map(name => ({
      name,
      isQty: QUANTITY_CHORES.includes(name),
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
  document.getElementById("status-dot").className = "status-dot " + state;
  document.getElementById("status-text").textContent = msg;
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

    // Aggregate by day
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
    await appendDiary(currentUser, text);
    textarea.value = "";
    setDiaryStatus("ok", "Entry saved!");
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
    const rows = await readDiary();
    const list = document.getElementById("diary-list");
    if (rows.length === 0) {
      list.innerHTML = `<div class="empty-state">No entries yet.</div>`;
      setDiaryStatus("ok", "No entries yet.");
      return;
    }
    list.innerHTML = rows.map((row, idx) => `
      <div class="diary-entry" id="diary-entry-${idx}">
        <div class="diary-entry-header" onclick="toggleDiaryEntry(${idx})">
          <div class="diary-entry-meta">
            <span class="diary-entry-date">${row.timestamp}</span>
            ${row.user ? `<span class="hist-user">${row.user}</span>` : ""}
          </div>
          <span class="diary-entry-preview" id="diary-preview-${idx}">${row.entry.substring(0, 60)}${row.entry.length > 60 ? "…" : ""}</span>
          <span class="diary-chevron" id="diary-chevron-${idx}">›</span>
        </div>
        <div class="diary-entry-body" id="diary-body-${idx}">${row.entry.replace(/\n/g, "<br>")}</div>
      </div>`).join("");
    setDiaryStatus("ok", `${rows.length} entr${rows.length !== 1 ? "ies" : "y"} loaded.`);
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
function formatTimestamp(ts) {
  if (!ts) return "—";
  const d    = new Date(ts);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (isNaN(diff)) return ts; // fallback if parse fails
  if (diff < 60)     return "Just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return ts.split(",")[0]; // just the date portion
}
