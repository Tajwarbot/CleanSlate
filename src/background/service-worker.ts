/**
 * CleanSlate Service Worker (Background Script)
 *
 * Message router and operation coordinator.
 * Validates all incoming messages. Never trusts webpage data as instructions.
 */

import { MessageType, type ExtensionMessage } from '../types/messages';
import type { ActivityCategory } from '../types/common';
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
      sendResponse({ state: 'IDLE' });
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
    case MessageType.PauseOperation:
    case MessageType.ResumeOperation:
    case MessageType.StopOperation:
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
