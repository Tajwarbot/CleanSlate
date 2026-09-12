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
| **Manifest V3** | `manifest.json` | ✅ Complete | MV3 permissions, background SW, content script matches, locales |
| **State Machine** | `src/core/state/state-machine.ts` | ✅ Complete | Deterministic lifecycle (Idle -> Scanning -> Preview -> Confirm -> Executing -> Complete) |
| **Safety Controller** | `src/core/safety/safety-controller.ts` | ✅ Complete | Rate limit detection, error counters, safety circuit breaker |
| **Operation Controller** | `src/core/controller/operation-controller.ts` | ✅ Complete | Manages scans, previews, dry-runs, batch execution, report generation |
| **Scheduler** | `src/core/scheduler/scheduler.ts` | ✅ Complete | Human-like random delay batch scheduler with pause/resume/stop |
| **Storage Layer** | `src/storage/` | ✅ Complete | Settings persistence & session state recovery after browser reload |
| **Service Worker** | `src/background/service-worker.ts` | ✅ Complete | Strongly-typed message router between popup and content scripts |
| **React Popup UI** | `src/ui/popup/` | ✅ Complete | 8 Page Views, 7 Shared Components, custom hook, CSS design system |
| **Build & Package** | `vite.config.ts`, `scripts/` | ✅ Complete | Vite pipeline, PNG icon generator, zip package, browser launcher |
| **Facebook DOM Adapter** | `src/adapters/facebook-adapter.ts` | ✅ Complete | Live DOM activity scanning, action execution, modal confirmation, verification |
| **Messenger DOM Adapter** | `src/adapters/messenger-adapter.ts` | ✅ Complete | Live conversation discovery, chat deletion, confirmation handling, verification |
| **Content Script Wiring** | `src/content/index.ts` | ✅ Complete | Injected script connecting DOM adapters to Service Worker messaging |

---

## 🚀 One-Click Non-Technical Installation

For non-CS users, we provide a 1-click launcher and installer:

### Option 1: Double-Click `install.bat` (Windows)
Double-click `install.bat` in the project folder. It builds the extension and launches Chrome / Edge with CleanSlate pre-loaded automatically.

### Option 2: Terminal One-Liner
```powershell
npm start
```
Or for packaging into a `.zip` file for manual uploading:
```powershell
npm run package
```

---

## 📝 Current Development Phase: Testing & Refinement

### Active Objectives
1. **End-to-End Testing**: Unit tests for adapters, safety controller, and state machine using Vitest.
2. **Localization (i18n)**: Extend `_locales/en/messages.json` strings for any remaining UI labels.
3. **Documentation & Release Packaging**: Finalizing release artifacts for browser extension stores.
