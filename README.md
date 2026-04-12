# Home Journal

A personal household web app for logging chores, wildlife sightings, and diary entries. Built as a progressive web app (PWA) that runs in any mobile browser and can be installed on your home screen like a native app.

Data is stored in a Google Sheet in a shared Google Drive account, giving you a permanent, human-readable record with no storage limits.

## Features

- **Chores** — one-tap logging with inline history per chore. Supports quantity input for chores like "Bags of salt". New chores are added on the fly and appear on all devices automatically.
- **Wildlife** — log species sightings with aggregated daily history. Species are sorted by most recently logged. New species added on the fly.
- **Diary** — long-form text entries, collapsed/expandable list of past entries.
- **Per-device default user** — each device remembers who normally logs from it (MLE or CYD), with easy in-session switching.
- **Google Sheets backend** — all data stored in a single shared spreadsheet with three tabs: Chores, Wildlife, Diary.

## Architecture

| File | Purpose |
|---|---|
| `index.html` | App shell, HTML structure |
| `style.css` | All styling |
| `app.js` | UI logic, tab management, chore/wildlife/diary functions |
| `sheets.js` | Google Sheets API wrapper — read/write/create spreadsheet |
| `auth.js` | Google OAuth via Google Identity Services (GIS) |
| `manifest.json` | PWA manifest for Android home screen install |
| `icon.svg` | App icon (source) |
| `icon.png` | App icon (512×512, for iOS and Android) |

## Prerequisites

- A shared Google account (e.g. a family account) that all users will sign in with
- A [Google Cloud project](https://console.cloud.google.com) with:
  - Google Sheets API enabled
  - Google Drive API enabled
  - An OAuth 2.0 Web Application client ID
  - `https://mlehackett.github.io` listed under Authorized JavaScript Origins
  - The shared Google account added as a test user (OAuth consent screen → Audience → Test users)

## Deployment

The app is hosted as a static site on GitHub Pages at:

```
https://mlehackett.github.io/home_journal/
```

To deploy updates:
1. Edit the relevant file(s)
2. Commit and push to the `main` branch of the `home_journal` repo
3. GitHub Pages publishes automatically within a minute or two

## First-time Setup (per device)

1. Open `https://mlehackett.github.io/home_journal/` in the browser
2. Select the default user for this device (MLE or CYD)
3. Tap **Sign in with Google** and authenticate with the shared family account (`mlecyd24@gmail.com`)
4. On first run, the app will search Google Drive for an existing "Home Journal" spreadsheet and use it, or create a new one if none exists
5. Install to home screen (see below)

## Installing on iOS (iPhone / iPad)

1. Open Safari and navigate to `https://mlehackett.github.io/home_journal/`
2. Sign in with Google if prompted
3. Tap the **Share** button (box with arrow pointing up, at the bottom of the screen)
4. Scroll down and tap **Add to Home Screen**
5. Give it a name (e.g. "Home Journal") and tap **Add**

The app will appear on your home screen with the house-on-water icon and open full screen without any browser chrome.

> **Note:** Safari caches aggressively. If the icon doesn't update after a change, delete the home screen shortcut and re-add it after clearing Safari's cache in Settings → Safari → Clear History and Website Data.

## Installing on Android (Chrome)

1. Open Chrome and navigate to `https://mlehackett.github.io/home_journal/`
2. Sign in with Google if prompted
3. Tap the **three-dot menu** (⋮) in the top right
4. Tap **Add to Home screen**
5. Give it a name and tap **Add**

Alternatively, Chrome may show an automatic "Add to Home screen" banner — tap it to install.

The app will appear on your home screen and launch in standalone mode (no browser bar) using the house-on-water icon.

## Adding a New Chore or Species

Use the **Add & Log Other** field at the bottom of the Chores or Wildlife tab. Type the name and tap **Log It**. This logs the first entry immediately and the item appears on all devices the next time they load the tab.

## Special Cases

**Bags of salt** is treated as a quantity chore — a +/− spinner appears instead of a simple tap. To add other quantity-based chores in the future, edit the `QUANTITY_CHORES` array in `app.js`:

```javascript
const QUANTITY_CHORES = ["bags of salt"]; // lowercase, matched case-insensitively
```

## Google Cloud Console

The OAuth client is registered at:
- **Project:** Home Journal (`home-journal-492802`)
- **Client ID:** `1042216799322-nejjr34u08ugkdkb5vdmqlk7mdsg7prd.apps.googleusercontent.com`
- **Authorized JavaScript Origins:** `https://mlehackett.github.io`
- **Scopes:** `spreadsheets`, `drive.file`

If you need to add a new test user or change OAuth settings, go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Google Auth Platform.

## Data

All data is stored in a Google Sheet named **Home Journal** in the `mlecyd24@gmail.com` Google Drive. The sheet has three tabs:

| Tab | Columns |
|---|---|
| Chores | Timestamp, User, Chore, Quantity |
| Wildlife | Timestamp, User, Species |
| Diary | Timestamp, User, Entry |

The spreadsheet URL is visible in the app under **Settings → Google Sheets → Open spreadsheet**.

## Known Limitations

- The "Sign in with Google" consent screen shows a warning that the app is in testing mode. This is normal for a private app — tap **Continue** to proceed.
- The OAuth token expires after one hour. The app will prompt for re-authentication automatically when needed.
