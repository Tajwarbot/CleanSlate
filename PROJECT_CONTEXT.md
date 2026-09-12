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
| **Content Script Wiring** | `src/content/index.ts` | ✅ Complete | Injected script connecting DOM adapters to Service Worker messaging |

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
- **SW → Content**: `SCAN_REQUEST`, `DETECT_CAPABILITIES`, `EXECUTE_ITEM`, `VERIFY_ITEM`
- **Content → SW**: Returns `{ status, items }` or `{ status, result }`

All messages are validated via `src/utils/validation.ts` using typed `ExtensionMessage` unions. Content scripts cannot issue operation commands (enforced by authorization checks).

---

## 🛡️ Key Gotchas & Known Constraints

1. **Content Script MUST be IIFE**: Never add the content script to the main Vite build's `rollupOptions.input`. It must be built separately as IIFE (see Build System section above). ES module imports will cause a **silent failure**.
2. **`scripting` Permission Required**: The service worker uses `chrome.scripting.executeScript()` as a fallback when the content script isn't already injected. The `scripting` permission must be in `manifest.json`.
3. **No Silent Extension Install**: Chromium prevents silent installation of local extensions. Users must manually confirm "Load Unpacked" once per profile.
4. **DOM Selectors Are Fragile**: Facebook/Messenger frequently updates their DOM. The adapters use a layered selector strategy (ARIA → data attributes → structural fallbacks) but selectors may need updating.
5. **Stable Hook References (`useExtension`)**: The popup `useExtension` hook returns an object of callbacks. It must be wrapped in `useMemo` and the initial load effect in `App.tsx` must only run on mount (`[]`), otherwise React enters an infinite re-render loop blasting Chrome runtime messaging and locking the UI thread.
6. **Active Operation Coordination**: The service worker coordinates the async execution loop (`handleStartOperation` / `runExecutionLoop`) and broadcasts `OPERATION_PROGRESS` and `OPERATION_COMPLETE` messages to the popup to keep the progress UI reactive.

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
