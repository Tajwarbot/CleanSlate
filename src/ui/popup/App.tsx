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
import { ScanResultsPage } from './pages/ScanResultsPage';
import { ConfirmPage } from './pages/ConfirmPage';
import { ProgressPage } from './pages/ProgressPage';
import { CompletePage } from './pages/CompletePage';
import { ErrorPage } from './pages/ErrorPage';
import { SettingsPage } from './pages/SettingsPage';
import { useExtension, type ProgressUpdate } from './hooks/useExtension';
import { OperationState } from '../../types/state';
import { DEFAULT_SETTINGS, type ActivityCategory, type CleanSlateSettings } from '../../types/common';
import type { CleanupItem, OperationStats } from '../../types/operations';

// ---- Pages ----

type Page =
  | 'dashboard'
  | 'activity_select'
  | 'messenger_select'
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
};

// ---- Actions ----

type AppAction =
  | { type: 'SET_PAGE'; page: Page }
  | { type: 'SET_PLATFORM'; platform: string }
  | { type: 'SET_OPERATION_STATE'; state: OperationState }
  | { type: 'TOGGLE_DRY_RUN' }
  | { type: 'SET_SETTINGS'; settings: CleanSlateSettings }
  | { type: 'SET_CATEGORY'; category: ActivityCategory }
  | { type: 'SET_DISCOVERED_ITEMS'; items: CleanupItem[] }
  | { type: 'SET_SELECTED_ITEMS'; items: CleanupItem[] }
  | { type: 'SET_STATS'; stats: OperationStats }
  | { type: 'SET_OPERATION_ID'; operationId: string }
  | { type: 'SET_ERROR'; errorType: AppState['errorType']; message?: string }
  | { type: 'SET_INTERRUPTED_SESSION'; session: AppState['interruptedSession'] }
  | { type: 'SET_LAST_CLEANUP_COUNT'; count: number }
  | { type: 'SET_STOPPED_BY_USER'; stopped: boolean }
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

  // ---- Event handlers ----

  const goToDashboard = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const goToSettings = useCallback(() => {
    dispatch({ type: 'SET_PAGE', page: 'settings' });
  }, []);

  const openFacebookActivityLog = useCallback(async () => {
    const targetUrl = new URL('https://www.facebook.com/me/allactivity');
    targetUrl.searchParams.set('category_key', 'LIKESANDREACTIONSCLUSTER');
    const mode = state.dryRun ? 'preview' : 'execute';
    targetUrl.searchParams.set('cleanslate_action', 'reactions_cleanup');
    targetUrl.searchParams.set('cleanslate_mode', mode);
    targetUrl.hash = `cleanslate_action=reactions_cleanup&cleanslate_mode=${mode}`;

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      await chrome.storage.local.set({
        cleanslate_navigation: {
          platform: 'facebook',
          category: 'likes_reactions',
          action: 'reactions_cleanup',
          mode,
        },
      });
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      const targetTab = activeTab?.id && activeTab.url?.includes('facebook.com')
        ? activeTab
        : await chrome.tabs.create({ url: targetUrl.toString() });
      if (targetTab.id) {
        await chrome.storage.local.set({
          cleanslate_navigation: {
            platform: 'facebook',
            category: 'likes_reactions',
            action: 'reactions_cleanup',
            mode,
            tabId: targetTab.id,
          },
        });
        await chrome.tabs.update(targetTab.id, { url: targetUrl.toString() });
      }
      return;
    }

    window.open(targetUrl.toString(), '_blank');
  }, [state.dryRun]);

  const openMessengerConversations = useCallback(async () => {
    const targetUrl = 'https://www.messenger.com/';

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      await chrome.storage.local.set({
        cleanslate_navigation: {
          platform: 'messenger',
          category: 'conversations',
          action: 'scan',
          mode: state.dryRun ? 'preview' : 'execute',
        },
      });
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id && activeTab.url?.includes('messenger.com')) {
          chrome.tabs.update(activeTab.id, { url: targetUrl });
        } else {
          chrome.tabs.create({ url: targetUrl });
        }
      });
      return;
    }

    window.open(targetUrl, '_blank');
  }, [state.dryRun]);

  const handleScan = useCallback(
    async (category: ActivityCategory) => {
      dispatch({ type: 'SET_CATEGORY', category });
      dispatch({ type: 'SET_OPERATION_STATE', state: OperationState.Scanning });

      try {
        const result = (await ext.startScan(category, state.dryRun)) as {
          items?: CleanupItem[];
          error?: string;
        };

        if (result?.error) {
          dispatch({ type: 'SET_OPERATION_STATE', state: OperationState.Idle });
          dispatch({ type: 'SET_ERROR', errorType: 'unknown', message: result.error });
          return;
        }

        const items = (result?.items ?? []) as CleanupItem[];
        dispatch({ type: 'SET_DISCOVERED_ITEMS', items });
        dispatch({ type: 'SET_OPERATION_STATE', state: OperationState.PreviewReady });
        dispatch({ type: 'SET_PAGE', page: 'scan_results' });
      } catch (err) {
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
            onFacebookClick={openFacebookActivityLog}
            onMessengerClick={() => dispatch({ type: 'SET_PAGE', page: 'messenger_select' })}
            interruptedSession={state.interruptedSession}
            onReviewSession={handleReviewSession}
            onDiscardSession={handleDiscardSession}
            lastCleanupCount={state.lastCleanupCount}
          />
        )}

        {state.page === 'activity_select' && (
          <ActivitySelectPage
            onScan={handleScan}
            onCancel={goToDashboard}
          />
        )}

        {state.page === 'messenger_select' && (
          <MessengerSelectPage
            onOpenConversations={openMessengerConversations}
            onCancel={goToDashboard}
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
