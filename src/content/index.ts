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

const AUTOMATION_SETTLE_DELAY_MS = 1200;
const AUTOMATION_SCROLL_DELAY_MS = 700;
const AUTOMATION_MAX_SCROLLS = 40;
const AUTOMATION_WAIT_TIMEOUT_MS = 30000;
const AUTOMATION_POLL_INTERVAL_MS = 500;

/** Determine which platform we're on */
function detectPlatform(): 'facebook' | 'messenger' | 'unknown' {
  const hostname = window.location.hostname;
  if (hostname.includes('messenger.com')) return 'messenger';
  if (hostname.includes('facebook.com')) return 'facebook';
  return 'unknown';
}

function isVisible(element: Element): element is HTMLElement {
  const htmlElement = element as HTMLElement;
  return Boolean(htmlElement.isConnected && htmlElement.getClientRects().length > 0);
}

function getElementText(element: Element): string {
  return `${element.getAttribute('aria-label') || ''} ${element.textContent || ''}`
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getAutomationParameter(name: string): string | null {
  const url = new URL(window.location.href);
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  return url.searchParams.get(name) || hashParams.get(name);
}

function isReactionsAutomationTarget(): boolean {
  const url = new URL(window.location.href);
  return (
    url.pathname.includes('/me/allactivity') &&
    url.searchParams.get('category_key')?.toUpperCase() === 'LIKEDPOSTS' &&
    getAutomationParameter('cleanslate_action') === 'reactions_cleanup'
  );
}

async function waitForControl(
  findControl: () => HTMLElement | null,
): Promise<HTMLElement | null> {
  const deadline = Date.now() + AUTOMATION_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const control = findControl();
    if (control) return control;
    await new Promise((resolve) => setTimeout(resolve, AUTOMATION_POLL_INTERVAL_MS));
  }
  return null;
}

async function getStoredNavigation(): Promise<{
  platform?: string;
  category?: string;
  action?: string;
  mode?: string;
  tabId?: number;
} | null> {
  try {
    const result = await chrome.storage.local.get('cleanslate_navigation');
    return (result['cleanslate_navigation'] as {
      platform?: string;
      category?: string;
      action?: string;
      mode?: string;
      tabId?: number;
    } | undefined) || null;
  } catch {
    return null;
  }
}

async function waitForActivityItemsToLoad(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, AUTOMATION_SETTLE_DELAY_MS));

  let stableScrollHeightCount = 0;
  let previousScrollHeight = 0;

  for (let i = 0; i < AUTOMATION_MAX_SCROLLS && stableScrollHeightCount < 3; i++) {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    const scrollableContainers = Array.from(
      document.querySelectorAll<HTMLElement>('div, main, section'),
    ).filter((element) => {
      const style = window.getComputedStyle(element);
      return (
        element.scrollHeight > element.clientHeight + 32 &&
        (style.overflowY === 'auto' ||
          style.overflowY === 'scroll' ||
          style.overflowY === 'overlay' ||
          element.getAttribute('role') === 'main')
      );
    });

    for (const container of scrollableContainers) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      container.dispatchEvent(
        new WheelEvent('wheel', { bubbles: true, deltaY: container.clientHeight }),
      );
    }

    await new Promise((resolve) => setTimeout(resolve, AUTOMATION_SCROLL_DELAY_MS));

    const currentScrollHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight || 0,
      ...scrollableContainers.map((container) => container.scrollHeight),
    );
    stableScrollHeightCount =
      currentScrollHeight === previousScrollHeight ? stableScrollHeightCount + 1 : 0;
    previousScrollHeight = currentScrollHeight;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function findSelectAllCheckbox(): HTMLElement | null {
  const controls = Array.from(
    document.querySelectorAll('[role="checkbox"], input[type="checkbox"]'),
  );

  return (
    controls.find((control) => {
      if (!isVisible(control)) return false;
      let current: Element | null = control;
      for (let depth = 0; current && depth < 4; depth++, current = current.parentElement) {
        const text = getElementText(current);
        if (text === 'all' || text.startsWith('all ') || text.includes(' all ')) return true;
      }
      return false;
    }) as HTMLElement | undefined
  ) || null;
}

function findRemoveAllButton(): HTMLElement | null {
  const controls = Array.from(
    document.querySelectorAll('[role="button"], button, input[type="button"], input[type="submit"]'),
  );

  return (
    controls.find((control) => {
      if (!isVisible(control)) return false;
      const text = getElementText(control);
      return (
        text === 'remove' ||
        text === 'remove all' ||
        text.includes('remove all') ||
        text.endsWith(' remove')
      );
    }) as HTMLElement | undefined
  ) || null;
}

let reactionsAutomationRunning = false;

async function runAutomaticReactionsCleanupImpl(
  forcedMode?: string,
): Promise<void> {
  if (detectPlatform() !== 'facebook') return;

  const storedNavigation = await getStoredNavigation();
  const isStoredReactionsTarget =
    storedNavigation?.platform === 'facebook' &&
    storedNavigation.category === FacebookCategory.LikesReactions &&
    storedNavigation.action === 'reactions_cleanup';

  if (!forcedMode && !isReactionsAutomationTarget() && !isStoredReactionsTarget) {
    return;
  }

  const routeDeadline = Date.now() + AUTOMATION_WAIT_TIMEOUT_MS;
  while (!isReactionsAutomationTarget() && Date.now() < routeDeadline) {
    await new Promise((resolve) => setTimeout(resolve, AUTOMATION_POLL_INTERVAL_MS));
  }
  if (!isReactionsAutomationTarget()) {
    logger.warn('Automatic cleanup stopped: Facebook Activity Log route was not reached');
    return;
  }

  const mode = forcedMode || getAutomationParameter('cleanslate_mode') || storedNavigation?.mode || 'preview';
  const runKey = `cleanslate:reactions_cleanup:${mode}`;
  if (sessionStorage.getItem(runKey) === window.location.href) return;

  logger.info('Starting automatic Likes & Reactions Activity Log workflow', {
    context: { mode },
  });

  await waitForActivityItemsToLoad();
  const scannedItems = await fbAdapter.scanActivity(FacebookCategory.LikesReactions);
  logger.info('Automatic Likes & Reactions scan completed', {
    context: { itemsFound: scannedItems.length },
  });

  const selectAll = await waitForControl(findSelectAllCheckbox);
  if (!selectAll) {
    logger.warn('Automatic cleanup stopped: Activity Log select-all control was not found');
    return;
  }
  sessionStorage.setItem(runKey, window.location.href);
  await chrome.storage.local.remove('cleanslate_navigation');

  if (selectAll.getAttribute('aria-checked') !== 'true' && !(selectAll as HTMLInputElement).checked) {
    selectAll.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (mode !== 'execute') {
    logger.info('Automatic cleanup preview complete; Remove was not clicked');
    return;
  }

  const removeAll = await waitForControl(findRemoveAllButton);
  if (!removeAll) {
    logger.warn('Automatic cleanup stopped: Activity Log remove control was not found');
    return;
  }

  removeAll.click();
  logger.info('Automatic Likes & Reactions removal requested');
}

async function runAutomaticReactionsCleanup(forcedMode?: string): Promise<void> {
  if (reactionsAutomationRunning) return;
  reactionsAutomationRunning = true;
  try {
    await runAutomaticReactionsCleanupImpl(forcedMode);
  } finally {
    reactionsAutomationRunning = false;
  }
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
        await waitForActivityItemsToLoad();
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

    case 'AUTOMATE_REACTIONS_CLEANUP': {
      const mode = typeof msg['mode'] === 'string' ? msg['mode'] : undefined;
      void runAutomaticReactionsCleanup(mode);
      return { status: 'started' };
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

void runAutomaticReactionsCleanup();
window.setInterval(() => {
  void runAutomaticReactionsCleanup();
}, 5000);
