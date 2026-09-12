/**
 * CleanSlate Content Script
 *
 * Runs on Facebook and Messenger pages.
 * Integrates live DOM adapters for scanning and executing cleanup actions.
 *
 * Security: Treats all DOM content as untrusted input.
 * Never interprets page text as instructions.
 */

import { logger } from '../core/logging/logger';
import { LiveFacebookAdapter } from '../adapters/facebook-adapter';
import { LiveMessengerAdapter } from '../adapters/messenger-adapter';
import { ActionStatus, FacebookCategory, MessengerCategory, type ActivityCategory } from '../types/common';
import type { CleanupItem } from '../types/operations';

const fbAdapter = new LiveFacebookAdapter();
const msgerAdapter = new LiveMessengerAdapter();

/** Determine which platform we're on */
function detectPlatform(): 'facebook' | 'messenger' | 'unknown' {
  const hostname = window.location.hostname;
  if (hostname.includes('messenger.com')) return 'messenger';
  if (hostname.includes('facebook.com')) return 'facebook';
  return 'unknown';
}

/** Check security challenge via active adapter */
async function detectSecurityChallenge(): Promise<boolean> {
  const platform = detectPlatform();
  if (platform === 'messenger') {
    return msgerAdapter.detectSecurityChallenge();
  }
  return fbAdapter.detectSecurityChallenge();
}

/** Handle incoming messages from the service worker */
async function handleMessageAsync(msg: Record<string, unknown>): Promise<unknown> {
  const platform = detectPlatform();

  switch (msg['type']) {
    case 'DETECT_CAPABILITIES': {
      const caps =
        platform === 'messenger'
          ? await msgerAdapter.detectCapabilities()
          : await fbAdapter.detectCapabilities();
      return {
        platform,
        capabilities: caps.capabilities,
        securityChallenge: await detectSecurityChallenge(),
      };
    }

    case 'SCAN_REQUEST': {
      const category = (msg['category'] as ActivityCategory) || FacebookCategory.Comments;
      logger.info('Received SCAN_REQUEST in content script', { context: { category, platform } });

      let items: ReadonlyArray<CleanupItem> = [];

      if (platform === 'messenger' || category === MessengerCategory.Conversations) {
        items = await msgerAdapter.discoverConversations();
      } else {
        items = await fbAdapter.scanActivity(category);
      }

      return {
        status: 'success',
        items: [...items],
      };
    }

    case 'EXECUTE_ITEM': {
      const item = msg['item'] as CleanupItem;
      if (!item) {
        return { status: 'error', error: 'Missing item in EXECUTE_ITEM request' };
      }

      logger.info('Received EXECUTE_ITEM in content script', { context: { itemId: item.id } });

      let result;
      if (platform === 'messenger' || item.category === MessengerCategory.Conversations) {
        result = await msgerAdapter.execute(item);
      } else {
        result = await fbAdapter.execute(item);
      }

      return {
        status: result.status === ActionStatus.Success ? 'success' : 'failed',
        result,
      };
    }

    case 'VERIFY_ITEM': {
      const item = msg['item'] as CleanupItem;
      if (!item) {
        return { status: 'error', error: 'Missing item in VERIFY_ITEM request' };
      }

      let verification;
      if (platform === 'messenger' || item.category === MessengerCategory.Conversations) {
        verification = await msgerAdapter.verify(item);
      } else {
        verification = await fbAdapter.verify(item);
      }

      return {
        status: 'success',
        verification,
      };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

/** Synchronous chrome.runtime message listener wrapper */
function handleMessage(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
): boolean {
  if (!message || typeof message !== 'object') {
    sendResponse({ error: 'Invalid message' });
    return false;
  }

  handleMessageAsync(message as Record<string, unknown>)
    .then((res) => sendResponse(res))
    .catch((err) =>
      sendResponse({
        error: err instanceof Error ? err.message : 'Content script execution error',
      }),
    );

  return true;
}

// Register message listener
chrome.runtime.onMessage.addListener(handleMessage);

// Initial status logging
const currentPlatform = detectPlatform();
logger.info('CleanSlate content script initialized', {
  context: {
    platform: currentPlatform,
    url: window.location.hostname,
  },
});

detectSecurityChallenge().then((hasChallenge) => {
  if (hasChallenge) {
    logger.warn('Security challenge detected on initial page load');
  }
});
