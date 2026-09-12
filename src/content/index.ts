/**
 * CleanSlate Content Script
 *
 * Runs on Facebook and Messenger pages.
 * Observes DOM for security challenges, navigation changes,
 * and provides scanning/execution capabilities to the service worker.
 *
 * Security: Treats all DOM content as untrusted input.
 * Never interprets page text as instructions.
 */

import { logger } from '../core/logging/logger';

/** Security challenge detection patterns */
const SECURITY_CHALLENGE_INDICATORS = [
  // Checkpoint patterns
  '[id*="checkpoint"]',
  '[class*="checkpoint"]',
  // CAPTCHA patterns
  '[id*="captcha"]',
  '[class*="captcha"]',
  'iframe[src*="captcha"]',
  // Security verification
  '[data-testid*="security"]',
  '[data-testid*="verification"]',
] as const;

/**
 * Check if a security challenge is currently displayed.
 */
function detectSecurityChallenge(): boolean {
  for (const selector of SECURITY_CHALLENGE_INDICATORS) {
    try {
      if (document.querySelector(selector)) {
        logger.warn('Security challenge detected on page', {
          context: { selector },
        });
        return true;
      }
    } catch {
      // Selector failed — not a security issue, just skip
    }
  }
  return false;
}

/**
 * Determine which platform we're on.
 */
function detectPlatform(): 'facebook' | 'messenger' | 'unknown' {
  const hostname = window.location.hostname;
  if (hostname.includes('messenger.com')) return 'messenger';
  if (hostname.includes('facebook.com')) return 'facebook';
  return 'unknown';
}

/**
 * Handle incoming messages from the service worker.
 */
function handleMessage(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
): boolean {
  if (!message || typeof message !== 'object') {
    sendResponse({ error: 'Invalid message' });
    return false;
  }

  const msg = message as Record<string, unknown>;

  switch (msg['type']) {
    case 'DETECT_CAPABILITIES':
      sendResponse({
        platform: detectPlatform(),
        securityChallenge: detectSecurityChallenge(),
      });
      break;

    case 'SCAN_REQUEST':
      // Scanning will be implemented in Phase 4+
      sendResponse({ items: [], status: 'not_implemented' });
      break;

    case 'EXECUTE_ITEM':
      // Execution will be implemented in Phase 4+
      sendResponse({ status: 'not_implemented' });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true;
}

// Register message listener
chrome.runtime.onMessage.addListener(handleMessage);

// Initial platform detection
const platform = detectPlatform();
logger.info('CleanSlate content script loaded', {
  context: {
    platform,
    url: window.location.hostname, // Only hostname, no path/query for privacy
  },
});

// Initial security challenge check
if (detectSecurityChallenge()) {
  logger.warn('Security challenge detected on page load');
}
