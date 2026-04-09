// ── GOOGLE SHEETS API ─────────────────────────────────────────────────────────
// Handles spreadsheet creation, sheet setup, and data read/write.

const SPREADSHEET_NAME = "Home Journal";
const SHEETS_API       = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API        = "https://www.googleapis.com/drive/v3/files";

// Sheet names
const SHEET_CHORES   = "Chores";
const SHEET_WILDLIFE = "Wildlife";
const SHEET_DIARY    = "Diary";

// ── SPREADSHEET INIT ──────────────────────────────────────────────────────────

// Returns the spreadsheet ID, creating it if needed.
async function getOrCreateSpreadsheet() {
  // Check localStorage
  const stored = localStorage.getItem("spreadsheet_id");
  if (stored) return stored;
  return await createSpreadsheet();
}

async function createSpreadsheet() {
  const token = await getAccessToken();

  const body = {
    properties: { title: SPREADSHEET_NAME },
    sheets: [
      {
        properties: { title: SHEET_CHORES },
        data: [{ rowData: [{ values: _headerCells(["Timestamp", "User", "Chore", "Quantity"]) }] }]
      },
      {
        properties: { title: SHEET_WILDLIFE },
        data: [{ rowData: [{ values: _headerCells(["Timestamp", "User", "Species"]) }] }]
      },
      {
        properties: { title: SHEET_DIARY },
        data: [{ rowData: [{ values: _headerCells(["Timestamp", "User", "Entry"]) }] }]
      }
    ]
  };

  const res = await _sheetsRequest("POST", "", body, token);
  const id  = res.spreadsheetId;
  localStorage.setItem("spreadsheet_id", id);
  localStorage.setItem("spreadsheet_url", `https://docs.google.com/spreadsheets/d/${id}`);
  return id;
}

// ── APPEND ROWS ───────────────────────────────────────────────────────────────

async function appendChore(user, chore, quantity) {
  const id    = await getOrCreateSpreadsheet();
  const token = await getAccessToken();
  const ts    = _timestamp();
  await _sheetsRequest(
    "POST",
    `/${id}/values/${SHEET_CHORES}!A:D:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { values: [[ts, user, chore, quantity]] },
    token
  );
}

async function appendWildlife(user, species) {
  const id    = await getOrCreateSpreadsheet();
  const token = await getAccessToken();
  const ts    = _timestamp();
  await _sheetsRequest(
    "POST",
    `/${id}/values/${SHEET_WILDLIFE}!A:C:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { values: [[ts, user, species]] },
    token
  );
}

async function appendDiary(user, entry) {
  const id    = await getOrCreateSpreadsheet();
  const token = await getAccessToken();
  const ts    = _timestamp();
  await _sheetsRequest(
    "POST",
    `/${id}/values/${SHEET_DIARY}!A:C:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { values: [[ts, user, entry]] },
    token
  );
}

// ── READ ROWS ─────────────────────────────────────────────────────────────────

// Returns all chore rows (excluding header) as [{timestamp, user, chore, quantity}]
async function readChores() {
  const rows = await _readSheet(SHEET_CHORES, "A2:D");
  return (rows || []).map(r => ({
    timestamp: r[0] || "", user: r[1] || "", chore: r[2] || "", quantity: r[3] || ""
  })).reverse();
}

// Returns all wildlife rows as [{timestamp, user, species}]
async function readWildlife() {
  const rows = await _readSheet(SHEET_WILDLIFE, "A2:C");
  return (rows || []).map(r => ({
    timestamp: r[0] || "", user: r[1] || "", species: r[2] || ""
  })).reverse();
}

// Returns all diary rows as [{timestamp, user, entry}]
async function readDiary() {
  const rows = await _readSheet(SHEET_DIARY, "A2:C");
  return (rows || []).map(r => ({
    timestamp: r[0] || "", user: r[1] || "", entry: r[2] || ""
  })).reverse();
}

async function _readSheet(sheetName, range) {
  const id    = await getOrCreateSpreadsheet();
  const token = await getAccessToken();
  const res   = await _sheetsRequest("GET", `/${id}/values/${sheetName}!${range}`, null, token);
  return res.values || [];
}

// ── UNIQUE CHORE / SPECIES NAMES ──────────────────────────────────────────────

// Returns sorted unique chore names from the sheet
async function getUniqueChores() {
  const rows = await _readSheet(SHEET_CHORES, "C2:C");
  const names = [...new Set((rows || []).map(r => r[0]).filter(Boolean))].sort();
  return names;
}

async function getUniqueSpecies() {
  const rows = await _readSheet(SHEET_WILDLIFE, "C2:C");
  const names = [...new Set((rows || []).map(r => r[0]).filter(Boolean))].sort();
  return names;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function _timestamp() {
  return new Date().toLocaleString(undefined, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function _headerCells(labels) {
  return labels.map(label => ({
    userEnteredValue:  { stringValue: label },
    userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.86, green: 0.93, blue: 0.93 } }
  }));
}

async function _sheetsRequest(method, path, body, token) {
  const url = SHEETS_API + path;
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json"
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets API HTTP ${res.status}`);
  }
  return res.json();
}
