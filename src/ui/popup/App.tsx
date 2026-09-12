/**
 * App — root component for the CleanSlate popup.
 *
 * Manages page routing based on the operation state machine,
 * communicates with the service worker via useExtension,
 * and renders the appropriate page component.
 */

import { useCallback, useEffect, useReducer } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { DashboardPage } from './pages/DashboardPage';
import { ActivitySelectPage } from './pages/ActivitySelectPage';
import { MessengerSelectPage } from './pages/MessengerSelectPage';
import { GuidedCleanupPage } from './pages/GuidedCleanupPage';
import { ScanProgressPage } from './pages/ScanProgressPage';
import { ScanResultsPage } from './pages/ScanResultsPage';
import { ConfirmPage } from './pages/ConfirmPage';
import { ProgressPage } from './pages/ProgressPage';
import { CompletePage } from './pages/CompletePage';
import { ErrorPage } from './pages/ErrorPage';
import { SettingsPage } from './pages/SettingsPage';
import { useExtension, type ProgressUpdate } from './hooks/useExtension';
import { OperationState } from '../../types/state';
import {
  DEFAULT_SETTINGS,
  MessengerCategory,
  type ActivityCategory,
  type CleanSlateSettings,
} from '../../types/common';
import type { CleanupItem, OperationStats } from '../../types/operations';

const GUIDED_HANDOFF_STALE_MS = 60000;

// ---- Pages ----

type Page =
  | 'dashboard'
  | 'activity_select'
  | 'messenger_select'
  | 'guided_cleanup'
  | 'scan_progress'
  | 'scan_results'
  | 'confirm'
  | 'progress'
  | 'complete'
  | 'error'
  | 'settings';

// ---- State ----

interface AppState {
  page: Page;
  operationState: OperationState;
  platform: string;
  dryRun: boolean;
  settings: CleanSlateSettings;
  category: ActivityCategory | null;
  discoveredItems: CleanupItem[];
  selectedItems: CleanupItem[];
  stats: OperationStats | null;
  operationId: string | null;
  errorType: 'security_challenge' | 'rate_limited' | 'ui_changed' | 'max_failures' | 'unknown';
  errorMessage: string | null;
  interruptedSession: {
    operationId: string;
    category: string;
    processedItems: number;
    totalItems: number;
  } | null;
  lastCleanupCount: number | null;
  stoppedByUser: boolean;
  scanProgress: {
    phase: string;
    detail: string;
    loadedItems: number;
  };
}

const initialState: AppState = {
  page: 'dashboard',
  operationState: OperationState.Idle,
  platform: 'unknown',
  dryRun: DEFAULT_SETTINGS.dryRunDefault,
  settings: DEFAULT_SETTINGS,
  category: null,
  discoveredItems: [],
  selectedItems: [],
  stats: null,
  operationId: null,
  errorType: 'unknown',
  errorMessage: null,
  interruptedSession: null,
  lastCleanupCount: null,
  stoppedByUser: false,
  scanProgress: {
    phase: 'Preparing',
    detail: 'Waiting to start.',
    loadedItems: 0,
  },
};

// ---- Actions ----

type AppAction =
  | { type: 'SET_PAGE'; page: Page }
  | { type: 'SET_PLATFORM'; platform: string }
  | { type: 'SET_OPERATION_STATE'; state: OperationState }
  | { type: 'TOGGLE_DRY_RUN' }
  | { type: 'SET_SETTINGS'; settings: CleanSlateSettings }
  | { type: 'SET_CATEGORY'; category: ActivityCategory }
  | { type: 'SET_GUIDED_CATEGORY'; category: ActivityCategory }
  | { type: 'SET_DISCOVERED_ITEMS'; items: CleanupItem[] }
  | { type: 'SET_SELECTED_ITEMS'; items: CleanupItem[] }
  | { type: 'SET_STATS'; stats: OperationStats }
  | { type: 'SET_OPERATION_ID'; operationId: string }
  | { type: 'SET_ERROR'; errorType: AppState['errorType']; message?: string }
  | { type: 'SET_INTERRUPTED_SESSION'; session: AppState['interruptedSession'] }
  | { type: 'SET_LAST_CLEANUP_COUNT'; count: number }
  | { type: 'SET_STOPPED_BY_USER'; stopped: boolean }
  | { type: 'SET_SCAN_PROGRESS'; progress: AppState['scanProgress'] }
  | { type: 'RESET' };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, page: action.page };
    case 'SET_PLATFORM':
      return { ...state, platform: action.platform };
    case 'SET_OPERATION_STATE':
      return { ...state, operationState: action.state };
    case 'TOGGLE_DRY_RUN':
      return { ...state, dryRun: !state.dryRun };
    case 'SET_SETTINGS':
      return { ...state, settings: action.settings, dryRun: action.settings.dryRunDefault };
    case 'SET_CATEGORY':
      return { ...state, category: action.category };
    case 'SET_GUIDED_CATEGORY':
      return { ...state, category: action.category, page: 'guided_cleanup' };
    case 'SET_DISCOVERED_ITEMS':
      return { ...state, discoveredItems: action.items };
    case 'SET_SELECTED_ITEMS':
      return { ...state, selectedItems: action.items };
    case 'SET_STATS':
      return { ...state, stats: action.stats };
    case 'SET_OPERATION_ID':
      return { ...state, operationId: action.operationId };
    case 'SET_ERROR':
      return {
        ...state,
        page: 'error',
        errorType: action.errorType,
        errorMessage: action.message ?? null,
      };
    case 'SET_INTERRUPTED_SESSION':
      return { ...state, interruptedSession: action.session };
    case 'SET_LAST_CLEANUP_COUNT':
      return { ...state, lastCleanupCount: action.count };
    case 'SET_STOPPED_BY_USER':
      return { ...state, stoppedByUser: action.stopped };
    case 'SET_SCAN_PROGRESS':
      return { ...state, scanProgress: action.progress, page: 'scan_progress' };
    case 'RESET':
      return {
        ...initialState,
        settings: state.settings,
        dryRun: state.dryRun,
        platform: state.platform,
        lastCleanupCount: state.lastCleanupCount,
        interruptedSession: state.interruptedSession,
      };
    default:
      return state;
  }
}

// ---- Helper: map operation state to error type ----

function stateToErrorType(
  state: OperationState,
): AppState['errorType'] {
  switch (state) {
    case OperationState.SecurityChallenge:
      return 'security_challenge';
    case OperationState.RateLimited:
      return 'rate_limited';
    case OperationState.UIChanged:
      return 'ui_changed';
    case OperationState.ActionFailed:
      return 'max_failures';
    default:
      return 'unknown';
  }
}

// ---- App Component ----

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Handle progress updates from the service worker
  const handleProgress = useCallback((update: ProgressUpdate) => {
    switch (update.type) {
      case 'progress':
        if (update.stats) {
          dispatch({ type: 'SET_STATS', stats: update.stats });
        }
        break;
      case 'complete':
        dispatch({ type: 'SET_OPERATION_STATE', state: OperationState.Completed });
        dispatch({ type: 'SET_PAGE', page: 'complete' });
        break;
      case 'error':
        dispatch({
          type: 'SET_ERROR',
          errorType: 'unknown',
          message: update.error?.message,
        });
        break;
      case 'state':
        if (update.state) {
          dispatch({ type: 'SET_OPERATION_STATE', state: update.state });
          // Navigate to error page if we entered an error state
          if ([
            OperationState.SecurityChallenge,
            OperationState.RateLimited,
            OperationState.UIChanged,
            OperationState.ActionFailed,
            OperationState.UnknownState,
          ].includes(update.state)) {
            dispatch({ type: 'SET_ERROR', errorType: stateToErrorType(update.state) });
          }
        }
        if (update.stats) {
          dispatch({ type: 'SET_STATS', stats: update.stats });
        }
        break;
    }
  }, []);

  const ext = useExtension({ onProgressUpdate: handleProgress });

  // Initial load: get state, settings, session, and capabilities
  useEffect(() => {
    async function init() {
      try {
        const [stateResp, settingsResp, sessionResp] = await Promise.allSettled([
          ext.getState(),
          ext.getSettings(),
          ext.getInterruptedSession(),
        ]);

        if (stateResp.status === 'fulfilled' && stateResp.value.state) {
          dispatch({ type: 'SET_OPERATION_STATE', state: stateResp.value.state as OperationState });
        }

        if (settingsResp.status === 'fulfilled' && settingsResp.value.settings) {
          dispatch({ type: 'SET_SETTINGS', settings: settingsResp.value.settings });
        }

        if (sessionResp.status === 'fulfilled' && sessionResp.value.session) {
          dispatch({ type: 'SET_INTERRUPTED_SESSION', session: sessionResp.value.session });
        }

        const pending = await chrome.storage.local.get('cleanslate_guided_category');
        const pendingValue = pending['cleanslate_guided_category'] as
          | ActivityCategory
          | { category?: ActivityCategory; updatedAt?: number }
          | undefined;
        const pendingCategory =
          typeof pendingValue === 'string'
            ? pendingValue
            : pendingValue?.category;
        const pendingUpdatedAt =
          typeof pendingValue === 'object' && pendingValue
            ? pendingValue.updatedAt
            : undefined;
        const guidedHandoffIsRecent =
          typeof pendingUpdatedAt === 'number' &&
          Date.now() - pendingUpdatedAt < GUIDED_HANDOFF_STALE_MS;
        if (pendingCategory && guidedHandoffIsRecent) {
          dispatch({ type: 'SET_GUIDED_CATEGORY', category: pendingCategory });
        } else if (pendingValue) {
          await chrome.storage.local.remove('cleanslate_guided_category');
        }

        const scan = await chrome.storage.local.get('cleanslate_scan_progress');
        const scanProgress = scan['cleanslate_scan_progress'] as {
          status?: string;
          phase?: string;
          detail?: string;
          loadedItems?: number;
          items?: CleanupItem[];
          category?: ActivityCategory;
          updatedAt?: number;
        } | undefined;
        if (scanProgress?.status === 'scanning') {
          if (scanProgress.category) {
            dispatch({ type: 'SET_CATEGORY', category: scanProgress.category });
          }
          dispatch({
            type: 'SET_SCAN_PROGRESS',
            progress: {
              phase: scanProgress.phase || 'Loading activity',
              detail: scanProgress.detail || 'Loading activity in the Facebook tab.',
              loadedItems: scanProgress.loadedItems || 0,
            },
          });
        } else if (scanProgress?.status === 'complete' && scanProgress.items && scanProgress.category) {
          dispatch({ type: 'SET_CATEGORY', category: scanProgress.category });
          dispatch({ type: 'SET_DISCOVERED_ITEMS', items: scanProgress.items });
          dispatch({ type: 'SET_OPERATION_STATE', state: OperationState.PreviewReady });
          dispatch({ type: 'SET_PAGE', page: 'scan_results' });
        }

        // Detect platform
        try {
          const capResp = await ext.detectCapabilities();
          if (capResp.platform) {
            dispatch({ type: 'SET_PLATFORM', platform: capResp.platform });
          }
        } catch {
          // Content script might not be available (not on Facebook/Messenger)
        }
      } catch {
        // Extension APIs may not be available in dev mode
      }
    }
    void init();
  }, []); // Run once on mount to prevent infinite re-render loops

  useEffect(() => {
    const applyTheme = () => {
      const theme = state.settings.theme;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const resolvedTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolvedTheme;
    };

    applyTheme();
    if (state.settings.theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [state.settings.theme]);

  useEffect(() => {
    if (state.page !== 'scan_progress') return;

    let cancelled = false;
    const poll = async () => {
      const result = await chrome.storage.local.get('cleanslate_scan_progress');
      const progress = result['cleanslate_scan_progress'] as {
        status?: string;
        phase?: string;
        detail?: string;
        loadedItems?: number;
        items?: CleanupItem[];
        category?: ActivityCategory;
        updatedAt?: number;
      } | undefined;
      if (cancelled || !progress) return;

      if (progress.status === 'complete' && progress.items && progress.category) {
        dispatch({ type: 'SET_CATEGORY', category: progress.category });
        dispatch({ type: 'SET_DISCOVERED_ITEMS', items: progress.items });
        dispatch({ type: 'SET_OPERATION_STATE', state: OperationState.PreviewReady });
        dispatch({ type: 'SET_PAGE', page: 'scan_results' });
        return;
      }

      dispatch({
        type: 'SET_SCAN_PROGRESS',
        progress: {
          phase: progress.phase || 'Loading activity',
          detail: progress.detail || 'Loading activity in the active tab.',
          loadedItems: progress.loadedItems || 0,
        },
      });
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 700);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [state.page]);

  // ---- Event handlers ----

  const goToDashboard = useCallback(() => {
    void chrome.storage.local
      .set({ cleanslate_scan_control: { action: 'cancel', updatedAt: Date.now() } })
      .then(() =>
        chrome.storage.local.remove([
          'cleanslate_guided_category',
          'cleanslate_scan_progress',
        ]),
      );
    dispatch({ type: 'RESET' });
  }, []);

  const goToSettings = useCallback(() => {
    dispatch({ type: 'SET_PAGE', page: 'settings' });
  }, []);

  const beginGuidedCleanup = useCallback(async (category: ActivityCategory) => {
    await chrome.storage.local.set({
      cleanslate_guided_category: {
        category,
        updatedAt: Date.now(),
      },
    });
    dispatch({ type: 'SET_GUIDED_CATEGORY', category });
  }, []);

  const handleScan = useCallback(
    async (category: ActivityCategory) => {
      dispatch({ type: 'SET_CATEGORY', category });
      await chrome.storage.local.remove('cleanslate_guided_category');
      dispatch({ type: 'SET_OPERATION_STATE', state: OperationState.Scanning });
      await chrome.storage.local.set({
        cleanslate_scan_control: { action: 'continue', updatedAt: Date.now() },
        cleanslate_scan_progress: {
          status: 'scanning',
          phase: 'Connecting to page',
          detail: 'Checking the active Facebook or Messenger tab.',
          loadedItems: 0,
          category,
          updatedAt: Date.now(),
        },
      });
      dispatch({
        type: 'SET_SCAN_PROGRESS',
        progress: {
          phase: 'Connecting to page',
          detail: 'Checking the active Facebook or Messenger tab.',
          loadedItems: 0,
        },
      });

      try {
        const result = (await ext.startScan(category, state.dryRun)) as {
          items?: CleanupItem[];
          error?: string;
          status?: string;
        };

        if (result?.status === 'cancelled') {
          dispatch({ type: 'RESET' });
          return;
        }

        if (result?.error) {
          dispatch({ type: 'SET_OPERATION_STATE', state: OperationState.Idle });
          dispatch({ type: 'SET_ERROR', errorType: 'unknown', message: result.error });
          return;
        }

        const items = (result?.items ?? []) as CleanupItem[];
        await chrome.storage.local.remove('cleanslate_scan_control');
        dispatch({ type: 'SET_DISCOVERED_ITEMS', items });
        dispatch({ type: 'SET_OPERATION_STATE', state: OperationState.PreviewReady });
        dispatch({ type: 'SET_PAGE', page: 'scan_results' });
      } catch (err) {
        await chrome.storage.local.remove('cleanslate_scan_progress');
        dispatch({ type: 'SET_OPERATION_STATE', state: OperationState.Idle });
        dispatch({
          type: 'SET_ERROR',
          errorType: 'unknown',
          message: err instanceof Error ? err.message : 'Scan failed. Please try again.',
        });
      }
    },
    [ext, state.dryRun],
  );

  const handleStopLoading = useCallback(async () => {
    await chrome.storage.local.set({
      cleanslate_scan_control: { action: 'stop', updatedAt: Date.now() },
    });
  }, []);

  const handleContinueLoading = useCallback(async () => {
    await chrome.storage.local.set({
      cleanslate_scan_control: { action: 'continue', updatedAt: Date.now() },
    });
  }, []);

  const handleCancelScan = useCallback(async () => {
    await chrome.storage.local.set({
      cleanslate_scan_control: { action: 'stop', updatedAt: Date.now() },
    });
    await chrome.storage.local.remove('cleanslate_scan_progress');
    dispatch({ type: 'RESET' });
  }, []);

  const handleSelectItems = useCallback(
    (items: CleanupItem[]) => {
      dispatch({ type: 'SET_SELECTED_ITEMS', items });
      dispatch({ type: 'SET_PAGE', page: 'confirm' });
    },
    [],
  );

  const handleConfirm = useCallback(async () => {
    const opId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    dispatch({ type: 'SET_OPERATION_ID', operationId: opId });
    dispatch({ type: 'SET_OPERATION_STATE', state: OperationState.Executing });
    dispatch({ type: 'SET_STOPPED_BY_USER', stopped: false });
    dispatch({ type: 'SET_PAGE', page: 'progress' });

    try {
      await ext.startOperation(opId, state.category!, state.selectedItems, state.dryRun);
    } catch {
      dispatch({ type: 'SET_ERROR', errorType: 'unknown', message: 'Failed to start operation.' });
    }
  }, [ext, state.category, state.selectedItems, state.dryRun]);

  const handlePause = useCallback(async () => {
    if (state.operationId) {
      dispatch({ type: 'SET_OPERATION_STATE', state: OperationState.Paused });
      await ext.pauseOperation(state.operationId);
    }
  }, [ext, state.operationId]);

  const handleResume = useCallback(async () => {
    if (state.operationId) {
      dispatch({ type: 'SET_OPERATION_STATE', state: OperationState.Executing });
      await ext.resumeOperation(state.operationId);
    }
  }, [ext, state.operationId]);

  const handleStop = useCallback(async () => {
    if (state.operationId) {
      dispatch({ type: 'SET_STOPPED_BY_USER', stopped: true });
      dispatch({ type: 'SET_OPERATION_STATE', state: OperationState.Completed });
      dispatch({ type: 'SET_PAGE', page: 'complete' });
      await ext.stopOperation(state.operationId);
    }
  }, [ext, state.operationId]);

  const handleAcknowledgeError = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const handleSaveSettings = useCallback(
    async (settings: Partial<CleanSlateSettings>) => {
      try {
        const resp = await ext.updateSettings(settings);
        if (resp.settings) {
          dispatch({ type: 'SET_SETTINGS', settings: resp.settings });
        }
      } catch {
        // Silently handle
      }
    },
    [ext],
  );

  const handleResetSettings = useCallback(async () => {
    await handleSaveSettings(DEFAULT_SETTINGS);
  }, [handleSaveSettings]);

  const handleDiscardSession = useCallback(async () => {
    dispatch({ type: 'SET_INTERRUPTED_SESSION', session: null });
    await ext.discardSession();
  }, [ext]);

  const handleReviewSession = useCallback(() => {
    // For now, just go to dashboard — full session recovery will be implemented in a later phase
    dispatch({ type: 'SET_INTERRUPTED_SESSION', session: null });
  }, []);

  // ---- Render ----

  const showBack = state.page !== 'dashboard' && state.page !== 'progress';

  return (
    <div className="cs-popup">
      <Header
        showBack={showBack}
        onBackClick={goToDashboard}
        onSettingsClick={state.page === 'dashboard' ? goToSettings : undefined}
      />

      <div className="cs-content">
        {state.page === 'dashboard' && (
          <DashboardPage
            operationState={state.operationState}
            platform={state.platform}
            dryRun={state.dryRun}
            onDryRunToggle={() => dispatch({ type: 'TOGGLE_DRY_RUN' })}
            onFacebookClick={() => dispatch({ type: 'SET_PAGE', page: 'activity_select' })}
            onMessengerClick={() => dispatch({ type: 'SET_PAGE', page: 'messenger_select' })}
            interruptedSession={state.interruptedSession}
            onReviewSession={handleReviewSession}
            onDiscardSession={handleDiscardSession}
            lastCleanupCount={state.lastCleanupCount}
          />
        )}

        {state.page === 'activity_select' && (
          <ActivitySelectPage
            onScan={beginGuidedCleanup}
            onCancel={goToDashboard}
          />
        )}

        {state.page === 'messenger_select' && (
          <MessengerSelectPage
            onOpenConversations={() => beginGuidedCleanup(MessengerCategory.Conversations)}
            onCancel={goToDashboard}
          />
        )}

        {state.page === 'guided_cleanup' && state.category && (
          <GuidedCleanupPage
            category={state.category}
            onStart={handleScan}
            onCancel={goToDashboard}
          />
        )}

        {state.page === 'scan_progress' && (
          <ScanProgressPage
            phase={state.scanProgress.phase}
            detail={state.scanProgress.detail}
            loadedItems={state.scanProgress.loadedItems}
            onStopLoading={handleStopLoading}
            onContinueLoading={handleContinueLoading}
            onCancelScan={handleCancelScan}
          />
        )}

        {state.page === 'scan_results' && (
          <ScanResultsPage
            items={state.discoveredItems}
            category={state.category ?? ''}
            onContinue={handleSelectItems}
            onCancel={goToDashboard}
          />
        )}

        {state.page === 'confirm' && (
          <ConfirmPage
            selectedCount={state.selectedItems.length}
            category={state.category ?? ''}
            dryRun={state.dryRun}
            onConfirm={handleConfirm}
            onCancel={goToDashboard}
          />
        )}

        {state.page === 'progress' && (
          <ProgressPage
            stats={state.stats}
            paused={state.operationState === OperationState.Paused}
            dryRun={state.dryRun}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
          />
        )}

        {state.page === 'complete' && (
          <CompletePage
            stats={state.stats}
            dryRun={state.dryRun}
            stoppedByUser={state.stoppedByUser}
            onStartAnother={goToDashboard}
          />
        )}

        {state.page === 'error' && (
          <ErrorPage
            errorType={state.errorType}
            message={state.errorMessage ?? undefined}
            onAcknowledge={handleAcknowledgeError}
          />
        )}

        {state.page === 'settings' && (
          <SettingsPage
            settings={state.settings}
            onSave={handleSaveSettings}
            onReset={handleResetSettings}
            onBack={goToDashboard}
          />
        )}
      </div>

      <Footer />
    </div>
  );
}
