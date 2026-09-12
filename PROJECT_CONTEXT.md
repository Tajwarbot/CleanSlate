# CleanSlate — Master Project Status & Context Document

> **Notice for Future AI Agents**: Read this document first! It provides complete context on CleanSlate's architecture, current implementation progress, objective, and next steps.

---

## 🎯 Master Objective
**CleanSlate** is a professional, privacy-first, open-source browser extension (Manifest V3) that helps users manage and remove their own Facebook and Messenger activity through normal browser interfaces without using external APIs or requiring user credentials.

### Key Core Principles
1. **Local & Privacy-First**: 100% client-side execution. Zero external telemetry, tracking, or remote servers.
2. **Defensive & Rate-Limited**: Built-in human-like delays, safety circuit breakers, and automatic security challenge (CAPTCHA/checkpoint) detection.
3. **Fail-Closed State Machine**: Operation states strictly governed by a deterministic state machine.
4. **Resilient DOM Layering**: Uses accessible names (`aria-label`, `role`), semantic attributes, and structural fallbacks to withstand Facebook UI updates.

---

## 🏗️ Architecture & Component Status

| Component | Path | Status | Summary |
|---|---|---|---|
| **Manifest V3** | `manifest.json` | ✅ Complete | MV3 permissions (`storage`, `activeTab`, `scripting`), background SW, content script matches, locales |
| **State Machine** | `src/core/state/state-machine.ts` | ✅ Complete | Deterministic lifecycle (Idle → Scanning → Preview → Confirm → Executing → Complete) |
| **Safety Controller** | `src/core/safety/safety-controller.ts` | ✅ Complete | Rate limit detection, error counters, safety circuit breaker |
| **Operation Controller** | `src/core/controller/operation-controller.ts` | ✅ Complete | Manages scans, previews, dry-runs, batch execution, report generation |
| **Scheduler** | `src/core/scheduler/scheduler.ts` | ✅ Complete | Human-like random delay batch scheduler with pause/resume/stop |
| **Storage Layer** | `src/storage/` | ✅ Complete | Settings persistence & session state recovery after browser reload |
| **Service Worker** | `src/background/service-worker.ts` | ✅ Complete | Live message router connecting popup UI to active tab content script |
| **React Popup UI** | `src/ui/popup/` | ✅ Complete | 8 Page Views, 7 Shared Components, custom hook, CSS design system |
| **Build System** | `vite.config.ts` | ✅ Complete | Two-pass Vite build: ES modules for popup/SW + IIFE for content script |
| **Installer / Launcher** | `scripts/launch.mjs`, `install.bat` | ✅ Complete | Interactive browser & profile selector CLI installer |
| **Packaging** | `scripts/package.mjs` | ✅ Complete | Creates `cleanslate-v0.1.0.zip` via PowerShell `Compress-Archive` |
| **Facebook DOM Adapter** | `src/adapters/facebook-adapter.ts` | ✅ Complete | Live DOM activity scanning, action execution, modal confirmation, verification |
| **Messenger DOM Adapter** | `src/adapters/messenger-adapter.ts` | ✅ Complete | Live conversation discovery, chat deletion, confirmation handling, verification |
| **Content Script Wiring** | `src/content/index.ts` | ✅ Complete | Injected script connecting DOM adapters to Service Worker messaging plus Activity Log automation |

---

## ⚙️ Build System — Two-Pass IIFE Architecture

> **Critical for Future AI Agents**: Chrome content scripts do **NOT** support ES module `import` statements. The content script must be built as an IIFE.

The Vite build (`vite.config.ts`) uses a **two-pass strategy**:

1. **Pass 1 — ES Modules** (main build):
   - `src/ui/popup/index.html` → `dist/ui/popup/popup.js` + CSS assets
   - `src/background/service-worker.ts` → `dist/background/service-worker.js`
   - Shared code is code-split into `dist/chunks/`
   - Service worker uses `"type": "module"` in manifest, popup uses `<script type="module">` — both support ES imports.

2. **Pass 2 — IIFE** (content script):
   - `src/content/index.ts` → `dist/content/content-script.js`
   - Built via Vite's `lib` mode with `formats: ['iife']`
   - **All dependencies inlined** — zero `import` statements, fully self-contained
   - Output starts with `(function(){"use strict";...})();`

Post-build, the plugin also copies `manifest.json`, `_locales/`, and `icons/` into `dist/`.

---

## 📁 Project File Structure

```
CleanSlate/
├── manifest.json              # MV3 extension manifest
├── vite.config.ts             # Two-pass build config
├── package.json               # Dependencies & npm scripts
├── install.bat                # Quick-launch shortcut
├── PROJECT_CONTEXT.md         # This file
│
├── src/
│   ├── adapters/              # Facebook & Messenger DOM adapters
│   ├── background/            # Service worker (message router)
│   ├── content/               # Content script (DOM bridge)
│   ├── core/                  # State machine, safety, scheduler, controller
│   ├── storage/               # Settings & session persistence
│   ├── types/                 # TypeScript types (messages, state, operations, common)
│   ├── ui/                    # React popup (components, pages, hooks, styles)
│   └── utils/                 # Validation, delays, ID generation
│
├── scripts/
│   ├── launch.mjs             # Interactive CLI browser/profile selector
│   ├── package.mjs            # Zip packager for distribution
│   ├── generate-icons.ps1     # Icon generation utility
│   ├── install-direct.ps1     # Direct install launcher
│   └── install-extension.ps1  # Extension install helper
│
├── dist/                      # Built extension (load this in chrome://extensions)
├── icons/                     # Extension icons (16, 32, 48, 128px)
└── _locales/                  # i18n (English)
```

---

## 🚀 Interactive Multi-Browser & Multi-Profile Installation

### Launching the Installer
Run either of the following commands:
```powershell
# Option 1: Double-click install.bat
install.bat

# Option 2: Terminal command
npm start
```

### Installer Capabilities
- **Browser Auto-Discovery**: Detects installed Chromium browsers (Brave, Google Chrome, Microsoft Edge, Opera, Vivaldi).
- **Profile Discovery**: Scans and lists user profiles (e.g. `Personal`, `Ahmad Taki Tajwar`, `Work`, `Default`).
- **Mode Options**:
  1. **Permanent Install**: Copies `dist` folder path to Windows Clipboard (`Ctrl+V`), opens File Explorer, and opens the chosen browser extensions page (`brave://extensions`, `chrome://extensions`).
  2. **Isolated Dev Window**: Launches a clean temporary profile pre-loaded with CleanSlate for testing.

---

## 🔄 Message Flow (Popup → Service Worker → Content Script)

```
┌─────────────┐    chrome.runtime     ┌─────────────────┐    chrome.tabs      ┌────────────────┐
│  Popup UI   │ ──── sendMessage ────→ │  Service Worker  │ ──── sendMessage ──→ │ Content Script │
│  (React)    │ ←─── response ──────── │  (Background)    │ ←─── response ────── │ (DOM Adapters) │
└─────────────┘                        └─────────────────┘                       └────────────────┘
```

- **Popup → SW**: `START_SCAN`, `DETECT_CAPABILITIES`, `START_OPERATION`, etc.
- **SW → Content**: `SCAN_REQUEST`, `DETECT_CAPABILITIES`, `EXECUTE_ITEM`, `VERIFY_ITEM`, `BULK_CLEANUP`
- **Content → SW**: Returns `{ status, items }` or `{ status, result }`

All messages are validated via `src/utils/validation.ts` using typed `ExtensionMessage` unions. Content scripts cannot issue operation commands (enforced by authorization checks).

### Persistent Scan Progress

Activity Log scans write progress to `chrome.storage.local` under `cleanslate_scan_progress`. The record contains the current phase, detail text, loaded-item count, category, discovered items when complete, status, and `updatedAt`. The popup reads and polls this record so closing and reopening the popup does not hide an active scan or discard completed results.

---

## 🛡️ Key Gotchas & Known Constraints

1. **Content Script MUST be IIFE**: Never add the content script to the main Vite build's `rollupOptions.input`. It must be built separately as IIFE (see Build System section above). ES module imports will cause a **silent failure**.
2. **`scripting` Permission Required**: The service worker uses `chrome.scripting.executeScript()` as a fallback when the content script isn't already injected. The `scripting` permission must be in `manifest.json`.
3. **No Silent Extension Install**: Chromium prevents silent installation of local extensions. Users must manually confirm "Load Unpacked" once per profile.
4. **DOM Selectors Are Fragile**: Facebook/Messenger frequently updates their DOM. The adapters use a layered selector strategy (ARIA → data attributes → structural fallbacks) but selectors may need updating.
5. **Stable Hook References (`useExtension`)**: The popup `useExtension` hook returns an object of callbacks. It must be wrapped in `useMemo` and the initial load effect in `App.tsx` must only run on mount (`[]`), otherwise React enters an infinite re-render loop blasting Chrome runtime messaging and locking the UI thread.
6. **Active Operation Coordination**: The service worker coordinates the async execution loop (`handleStartOperation` / `runExecutionLoop`) and broadcasts `OPERATION_PROGRESS` and `OPERATION_COMPLETE` messages to the popup to keep the progress UI reactive.
7. **Facebook Activity Log URLs & Discovery**: Never use `/your_information/activity_log` (Facebook displays 'Sorry, something went wrong'). Use the general `https://www.facebook.com/me/allactivity` route with category parameters: `LIKEDPOSTS` for likes and reactions, `COMMENTSCLUSTER` for comments, and `MANAGEPOSTSPHOTOSANDVIDEOS` for posts. Facebook may rewrite this route to `/profile.php?...&sk=allactivity`; validation must accept both forms. Items are discovered through language-agnostic 3-dots action buttons, checkboxes, and row containers rather than static feed selectors.
8. **Account-Specific Activity Log Workflow**: The guided flow requests the active profile ID from the Facebook content script and builds `/{profile-id}/allactivity` URLs with `activity_history=false`, `manage_mode=false`, `should_load_landing_page=false`, and the selected category key. This avoids Facebook treating `/me/allactivity` as the default latest-activity page. Because Facebook can rewrite the route, validation accepts both numeric profile paths and `/profile.php?...&sk=allactivity`; the content script reports activity context in real time so the guided UI can distinguish the general Activity Log from the requested category. The UI presents this as a plain-language page status instead of exposing the raw URL. A visible category label is not sufficient evidence: the category control must expose a selected/current/active state.
   Facebook may occasionally resolve the first navigation to the general Activity Log. The guided UI explicitly tells the user to click **Open correct page** a second time if the specific category has not settled yet.
9. **User-Controlled Lazy Loading and Native Bulk Removal**: Facebook Activity Log entries are lazy-loaded, so the content script scrolls the document and relevant inner scroll containers while writing progress after each pass. It compares both page height and rendered item count, requiring eight consecutive stable passes before treating loading as finished, while allowing the user to stop at the current batch. Facebook categories then use the page's native `All`, `Remove`, and confirmation controls for the loaded batch; the cleanup phase does not start a second full-page load. The UI calls the old dry-run behavior **Safety Preview**: it may select visible activity but never clicks `Remove`; Messenger conversations continue using the per-item adapter flow.
   Facebook cleanup selection is not synthesized by CleanSlate: the content script locates and clicks Facebook's visible native **All** checkbox, waits for Facebook to enable **Remove**, then clicks Facebook's native **Remove** and confirmation controls when Safety Preview is disabled.
   Scan progress records include `updatedAt`; the popup only restores a scanning screen while the record is fresh (15 seconds or less). Stale records are cleared so reopening the extension after an interrupted or finished scan returns to the dashboard instead of showing an old loading screen.
   Guided category handoff records also include `updatedAt` and expire after 60 seconds. This preserves the guided page across the popup closing during immediate navigation, but prevents an old category choice from forcing the guided screen on a later first open.
10. **Automation Guardrails**: Activity Log automation is opt-in through the `cleanslate_action=reactions_cleanup` URL parameter, runs once per matching page/mode using `sessionStorage`, checks visible accessible controls, and stops with a warning if the select-all, remove, or confirmation control cannot be confidently located.

---

## 🎨 UI Design System

- **Monochrome Palette**: High-contrast, minimal black and white aesthetic.
- **Zero Emojis**: Plain text indicators, clean labels, and standard text prefixes (`[NOTICE]`, `[WARNING]`, `[SAFETY PREVIEW]`).
- **Clean Layout**: No radial gradients, glow effects, or decorative drop shadows. Snappy and lightweight rendering.

---

## 📋 NPM Scripts Reference

| Script | Command | Description |
|---|---|---|
| `dev` | `npm run dev` | Watch mode development build |
| `build` | `npm run build` | TypeScript check + production Vite build |
| `start` | `npm start` | Interactive browser/profile installer |
| `package` | `npm run package` | Build + create zip for distribution |
| `lint` | `npm run lint` | ESLint on `src/` and `tests/` |
| `typecheck` | `npm run typecheck` | TypeScript type checking |
| `test` | `npm test` | Run Vitest unit tests |
| `clean` | `npm run clean` | Remove `dist/` directory |
