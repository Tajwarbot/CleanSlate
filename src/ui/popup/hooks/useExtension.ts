/**
 * useExtension — typed wrapper around chrome.runtime messaging.
 *
 * Provides methods for every message the popup can send, plus
 * a listener for incoming progress / state updates from the
 * service worker.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { MessageType, MessageSource, type ExtensionMessage } from '../../../types/messages';
import type { ActivityCategory, CleanSlateSettings } from '../../../types/common';
import type { OperationStats } from '../../../types/operations';
import type { OperationState } from '../../../types/state';
import { generateMessageId } from '../../../types/messages';

// ---- Helpers ----

function makeMessage(type: MessageType, extra: Record<string, unknown> = {}): ExtensionMessage {
  return {
    type,
    source: MessageSource.Popup,
    timestamp: Date.now(),
    id: generateMessageId(),
    ...extra,
  } as ExtensionMessage;
}

async function send<T = unknown>(msg: ExtensionMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response: unknown) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response as T);
    });
  });
}

// ---- Public types ----

export interface StateResponse {
  state: OperationState;
  stats?: OperationStats;
}

export interface SettingsResponse {
  settings: CleanSlateSettings;
}

export interface CapabilitiesResponse {
  capabilities: ReadonlyArray<{ category: string; status: string }>;
  platform?: string;
}

export interface SessionResponse {
  session: {
    operationId: string;
    category: string;
    processedItems: number;
    totalItems: number;
  } | null;
}

export interface ProgressUpdate {
  type: 'progress' | 'complete' | 'error' | 'state';
  stats?: OperationStats;
  state?: OperationState;
  error?: { code: string; message: string };
}

export interface UseExtensionOptions {
  onProgressUpdate?: (update: ProgressUpdate) => void;
}

// ---- Hook ----

export function useExtension(options: UseExtensionOptions = {}) {
  const callbackRef = useRef(options.onProgressUpdate);
  callbackRef.current = options.onProgressUpdate;

  // Listen for incoming messages from the service worker
  useEffect(() => {
    function listener(
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response: unknown) => void,
    ) {
      if (!message || typeof message !== 'object') return;
      const msg = message as Record<string, unknown>;

      if (msg['source'] === MessageSource.ServiceWorker) {
        const update: ProgressUpdate = { type: 'state' };

        switch (msg['type']) {
          case MessageType.OperationProgress:
            update.type = 'progress';
            update.stats = msg['stats'] as OperationStats;
            break;
          case MessageType.OperationComplete:
            update.type = 'complete';
            break;
          case MessageType.OperationError:
            update.type = 'error';
            update.error = msg['error'] as { code: string; message: string };
            break;
          case MessageType.StateUpdate:
            update.type = 'state';
            update.state = msg['state'] as OperationState;
            update.stats = msg['stats'] as OperationStats | undefined;
            break;
          default:
            return;
        }

        callbackRef.current?.(update);
      }
    }

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // ---- API methods ----

  const getState = useCallback(
    () => send<StateResponse>(makeMessage(MessageType.GetState)),
    [],
  );

  const getSettings = useCallback(
    () => send<SettingsResponse>(makeMessage(MessageType.GetSettings)),
    [],
  );

  const updateSettings = useCallback(
    (settings: Partial<CleanSlateSettings>) =>
      send<SettingsResponse>(makeMessage(MessageType.UpdateSettings, { settings })),
    [],
  );

  const detectCapabilities = useCallback(
    () => send<CapabilitiesResponse>(makeMessage(MessageType.DetectCapabilities)),
    [],
  );

  const startScan = useCallback(
    (category: ActivityCategory, dryRun: boolean) =>
      send<{ items: unknown[]; preview: unknown }>(
        makeMessage(MessageType.StartScan, { category, dryRun }),
      ),
    [],
  );

  const startOperation = useCallback(
    (operationId: string, category: ActivityCategory, items: unknown[], dryRun: boolean) =>
      send<{ acknowledged: boolean }>(
        makeMessage(MessageType.StartOperation, { operationId, category, items, dryRun }),
      ),
    [],
  );

  const pauseOperation = useCallback(
    (operationId: string) =>
      send<{ acknowledged: boolean }>(
        makeMessage(MessageType.PauseOperation, { operationId }),
      ),
    [],
  );

  const resumeOperation = useCallback(
    (operationId: string) =>
      send<{ acknowledged: boolean }>(
        makeMessage(MessageType.ResumeOperation, { operationId }),
      ),
    [],
  );

  const stopOperation = useCallback(
    (operationId: string) =>
      send<{ acknowledged: boolean }>(
        makeMessage(MessageType.StopOperation, { operationId }),
      ),
    [],
  );

  const getInterruptedSession = useCallback(
    () => send<SessionResponse>(makeMessage(MessageType.GetInterruptedSession)),
    [],
  );

  const discardSession = useCallback(
    () => send<{ acknowledged: boolean }>(makeMessage(MessageType.DiscardSession)),
    [],
  );

  return useMemo(
    () => ({
      getState,
      getSettings,
      updateSettings,
      detectCapabilities,
      startScan,
      startOperation,
      pauseOperation,
      resumeOperation,
      stopOperation,
      getInterruptedSession,
      discardSession,
    }),
    [
      getState,
      getSettings,
      updateSettings,
      detectCapabilities,
      startScan,
      startOperation,
      pauseOperation,
      resumeOperation,
      stopOperation,
      getInterruptedSession,
      discardSession,
    ],
  );
}
