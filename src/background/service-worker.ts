/**
 * CleanSlate Service Worker (Background Script)
 *
 * Message router and operation coordinator.
 * Validates all incoming messages. Never trusts webpage data as instructions.
 */

import { MessageType, MessageSource, generateMessageId, type ExtensionMessage } from '../types/messages';
import type { ActivityCategory } from '../types/common';
import type { CleanupItem, OperationStats } from '../types/operations';
import { OperationState } from '../types/state';
import { validateIncomingMessage, isAuthorizedMessage } from '../utils/validation';
import { logger } from '../core/logging/logger';

/**
 * Handle incoming messages from popup and content scripts.
 */
function handleMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
): boolean {
  // Validate the message
  const validMessage = validateIncomingMessage(message);
  if (!validMessage) {
    logger.warn('Invalid message received', {
      context: {
        senderId: sender.id ?? 'unknown',
        tabId: sender.tab?.id ?? -1,
      },
    });
    sendResponse({ error: 'Invalid message format' });
    return false;
  }

  // Check authorization
  if (!isAuthorizedMessage(validMessage)) {
    logger.warn('Unauthorized message rejected', {
      context: {
        type: validMessage.type,
        source: validMessage.source,
      },
    });
    sendResponse({ error: 'Unauthorized message source' });
    return false;
  }

  // Route message to handler
  routeMessage(validMessage, sender, sendResponse);

  // Return true for async response
  return true;
}

/**
 * Route validated messages to appropriate handlers.
 */
function routeMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
): void {
  logger.debug('Routing message', {
    context: {
      type: message.type,
      source: message.source,
    },
  });

  switch (message.type) {
    case MessageType.GetState:
      if (activeOperation) {
        sendResponse({
          state: activeOperation.paused ? OperationState.Paused : OperationState.Executing,
          stats: activeOperation.stats,
        });
      } else {
        sendResponse({ state: OperationState.Idle });
      }
      break;

    case MessageType.GetSettings:
      sendResponse({ settings: {} });
      break;

    case MessageType.DetectCapabilities:
      handleDetectCapabilities(sendResponse);
      break;

    case MessageType.StartScan:
      handleStartScan(message as ExtensionMessage & { category?: ActivityCategory; dryRun?: boolean }, sendResponse);
      break;

    case MessageType.StartOperation:
      handleStartOperation(
        message as unknown as {
          operationId: string;
          category: ActivityCategory;
          items: CleanupItem[];
          dryRun: boolean;
        },
        sendResponse,
      );
      break;

    case MessageType.PauseOperation:
      if (activeOperation) {
        activeOperation.paused = true;
      }
      sendResponse({ acknowledged: true });
      break;

    case MessageType.ResumeOperation:
      if (activeOperation) {
        activeOperation.paused = false;
      }
      sendResponse({ acknowledged: true });
      break;

    case MessageType.StopOperation:
      if (activeOperation) {
        activeOperation.stopped = true;
      }
      sendResponse({ acknowledged: true });
      break;

    case MessageType.GetInterruptedSession:
      sendResponse({ session: null });
      break;

    case MessageType.DiscardSession:
      sendResponse({ acknowledged: true });
      break;

    default:
      sendResponse({ error: 'Unhandled message type' });
  }
}

async function handleDetectCapabilities(sendResponse: (response: unknown) => void) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab || !activeTab.id || !activeTab.url) {
      sendResponse({ capabilities: [], platform: 'unknown' });
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        type: 'DETECT_CAPABILITIES',
      }) as { platform: string; capabilities: unknown[] };

      if (response) {
        sendResponse({ capabilities: response.capabilities || [], platform: response.platform || 'unknown' });
        return;
      }
    } catch {
      // Content script not ready
    }

    const isFb = activeTab.url.includes('facebook.com');
    const isMsger = activeTab.url.includes('messenger.com');
    sendResponse({
      capabilities: [],
      platform: isFb ? 'facebook' : isMsger ? 'messenger' : 'unknown',
    });
  } catch {
    sendResponse({ capabilities: [], platform: 'unknown' });
  }
}

async function handleStartScan(
  message: ExtensionMessage & { category?: ActivityCategory; dryRun?: boolean },
  sendResponse: (response: unknown) => void,
) {
  const category = message.category || 'comments';

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab || !activeTab.id || !activeTab.url) {
      sendResponse({ items: [], error: 'No active tab found' });
      return;
    }

    const isFb = activeTab.url.includes('facebook.com');
    const isMsger = activeTab.url.includes('messenger.com');

    if (!isFb && !isMsger) {
      sendResponse({
        items: [],
        error: 'Please open Facebook or Messenger in your browser tab before starting a scan.',
      });
      return;
    }

    let response: { status: string; items: unknown[]; error?: string } | null = null;

    try {
      response = (await chrome.tabs.sendMessage(activeTab.id, {
        type: 'SCAN_REQUEST',
        category,
        dryRun: message.dryRun,
      })) as { status: string; items: unknown[]; error?: string };
    } catch {
      // Content script not injected yet, try injecting script
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content/content-script.js'],
        });

        response = (await chrome.tabs.sendMessage(activeTab.id, {
          type: 'SCAN_REQUEST',
          category,
          dryRun: message.dryRun,
        })) as { status: string; items: unknown[]; error?: string };
      } catch {
        // Injection error
      }
    }

    const items = response?.items || [];
    sendResponse({
      items,
      preview: {
        category,
        totalItems: items.length,
        items,
        generatedAt: Date.now(),
      },
    });
  } catch (err) {
    sendResponse({ items: [], error: err instanceof Error ? err.message : 'Scan request failed' });
  }
}

interface ActiveOpState {
  operationId: string;
  category: ActivityCategory;
  items: CleanupItem[];
  dryRun: boolean;
  paused: boolean;
  stopped: boolean;
  tabId: number;
  stats: OperationStats;
}

let activeOperation: ActiveOpState | null = null;

async function handleStartOperation(
  message: {
    operationId: string;
    category: ActivityCategory;
    items: CleanupItem[];
    dryRun: boolean;
  },
  sendResponse: (response: unknown) => void,
) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    const tabId = activeTab?.id ?? -1;

    const items = message.items || [];
    const total = items.length;
    const startTime = Date.now();

    const initialStats: OperationStats = {
      operationId: message.operationId,
      category: message.category,
      totalItems: total,
      processedItems: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      unknownCount: 0,
      currentBatch: total > 0 ? 1 : 0,
      totalBatches: Math.max(1, Math.ceil(total / 5)),
      startedAt: startTime,
      elapsedMs: 0,
    };

    activeOperation = {
      operationId: message.operationId,
      category: message.category,
      items,
      dryRun: Boolean(message.dryRun),
      paused: false,
      stopped: false,
      tabId,
      stats: { ...initialStats },
    };

    sendResponse({ acknowledged: true });

    void runExecutionLoop();
  } catch (err) {
    sendResponse({ error: err instanceof Error ? err.message : 'Failed to start operation' });
  }
}

async function runExecutionLoop() {
  if (!activeOperation) return;

  const op = activeOperation;
  const items = op.items;
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < items.length; i++) {
    if (op.stopped) {
      break;
    }

    while (op.paused && !op.stopped) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (op.stopped) {
      break;
    }

    const item = items[i];
    if (!item) continue;

    if (op.dryRun) {
      // Realistic simulation pacing in dry-run mode
      await new Promise((resolve) => setTimeout(resolve, 500));
      successCount++;
    } else {
      try {
        const res = (await chrome.tabs.sendMessage(op.tabId, {
          type: 'EXECUTE_ITEM',
          item,
        })) as { status?: string };

        if (res?.status === 'success') {
          successCount++;
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    const processed = i + 1;
    op.stats = {
      ...op.stats,
      processedItems: processed,
      successCount,
      failedCount,
      currentBatch: Math.ceil(processed / 5),
      elapsedMs: Date.now() - op.stats.startedAt,
    };

    // Emit progress to popup
    chrome.runtime
      .sendMessage({
        type: MessageType.OperationProgress,
        source: MessageSource.ServiceWorker,
        timestamp: Date.now(),
        id: generateMessageId(),
        stats: { ...op.stats },
      })
      .catch(() => {
        // Popup may not be open or listening
      });
  }

  // Complete operation notification
  chrome.runtime
    .sendMessage({
      type: MessageType.OperationComplete,
      source: MessageSource.ServiceWorker,
      timestamp: Date.now(),
      id: generateMessageId(),
      report: {
        operationId: op.operationId,
        category: op.category,
        stats: { ...op.stats },
        results: [],
        verifications: [],
        startedAt: op.stats.startedAt,
        completedAt: Date.now(),
        durationMs: Date.now() - op.stats.startedAt,
        stoppedByUser: op.stopped,
        stoppedBySafety: false,
        dryRun: op.dryRun,
      },
    })
    .catch(() => {});

  activeOperation = null;
}

// Register message listener
chrome.runtime.onMessage.addListener(handleMessage);

// Service worker lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  logger.info('CleanSlate installed', {
    context: {
      reason: details.reason,
      previousVersion: details.previousVersion ?? 'none',
    },
  });
});

logger.info('CleanSlate service worker started');
