/**
 * CleanSlate Service Worker (Background Script)
 *
 * Message router and operation coordinator.
 * Validates all incoming messages. Never trusts webpage data as instructions.
 */

import { MessageType, type ExtensionMessage } from '../types/messages';
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
      // Settings will be loaded from storage in Phase 2+
      sendResponse({ settings: {} });
      break;

    case MessageType.DetectCapabilities:
      sendResponse({ capabilities: [] });
      break;

    case MessageType.StartScan:
    case MessageType.StartOperation:
    case MessageType.PauseOperation:
    case MessageType.ResumeOperation:
    case MessageType.StopOperation:
      // These will be fully implemented in Phase 3+
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
