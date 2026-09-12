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
const AUTOMATION_SCROLL_DELAY_MS = 1100;
const AUTOMATION_MAX_SCROLLS = 80;
const AUTOMATION_WAIT_TIMEOUT_MS = 30000;
const AUTOMATION_POLL_INTERVAL_MS = 500;
const AUTOMATION_STABLE_PASSES_TO_FINISH = 8;

/** Determine which platform we're on */
function detectPlatform(): 'facebook' | 'messenger' | 'unknown' {
  const hostname = window.location.hostname;
  if (hostname.includes('messenger.com')) return 'messenger';
  if (hostname.includes('facebook.com')) return 'facebook';
  return 'unknown';
}

function getProfileIdFromPage(): string | null {
  const currentUrl = new URL(window.location.href);
  const queryId = currentUrl.searchParams.get('id');
  if (queryId && /^\d+$/.test(queryId)) return queryId;

  const pathMatch = currentUrl.pathname.match(/^\/(\d+)(?:\/|$)/);
  if (pathMatch?.[1]) return pathMatch[1];

  const profileLink = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .map((link) => link.href)
    .find((href) => /facebook\.com\/(?:profile\.php\?id=)?\d+/.test(href));
  const linkMatch = profileLink?.match(/(?:profile\.php\?id=|facebook\.com\/)(\d+)/);
  return linkMatch?.[1] || null;
}

function isActivityLogUrl(url: URL): boolean {
  return (
    url.pathname.includes('/me/allactivity') ||
    /^\/\d+\/allactivity/.test(url.pathname) ||
    (url.pathname === '/profile.php' &&
      url.searchParams.get('sk')?.toLowerCase() === 'allactivity')
  );
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

async function isScanStopRequested(): Promise<boolean> {
  const result = await chrome.storage.local.get('cleanslate_scan_control');
  return (result['cleanslate_scan_control'] as { action?: string } | undefined)?.action === 'stop';
}

async function waitForActivityItemsToLoad(category?: ActivityCategory): Promise<boolean> {
  const writeProgress = async (phase: string, detail: string, loadedItems = 0) => {
    await chrome.storage.local.set({
      cleanslate_scan_progress: {
        status: 'scanning',
        phase,
        detail,
        loadedItems,
        category,
        updatedAt: Date.now(),
      },
    });
  };

  await writeProgress('Preparing Facebook', 'Waiting for the Activity Log controls to render.');
  await new Promise((resolve) => setTimeout(resolve, AUTOMATION_SETTLE_DELAY_MS));

  let stableContentCount = 0;
  let previousScrollHeight = 0;
  let previousItemCount = 0;

  for (
    let i = 0;
    i < AUTOMATION_MAX_SCROLLS && stableContentCount < AUTOMATION_STABLE_PASSES_TO_FINISH;
    i++
  ) {
    if (await isScanStopRequested()) {
      await writeProgress(
        'Stopped at current batch',
        'Loading stopped. The activity currently rendered on Facebook is ready to review.',
        document.querySelectorAll('[role="row"], [role="article"]').length,
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }

    await writeProgress(
      'Loading more activity',
      `Scrolling through Facebook activity (${i + 1}/${AUTOMATION_MAX_SCROLLS}).`,
      document.querySelectorAll('[role="row"], [role="article"]').length,
    );
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
    const currentItemCount = document.querySelectorAll('[role="row"], [role="article"]').length;
    stableContentCount =
      currentScrollHeight === previousScrollHeight && currentItemCount === previousItemCount
        ? stableContentCount + 1
        : 0;
    previousScrollHeight = currentScrollHeight;
    previousItemCount = currentItemCount;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  await writeProgress(
    'Reading loaded activity',
    'The page is loaded. Building a reviewable activity list.',
    document.querySelectorAll('[role="row"], [role="article"]').length,
  );
  return true;
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

async function runFacebookBulkCleanup(
  category: ActivityCategory,
  dryRun: boolean,
): Promise<{ status: 'success' | 'failed'; message?: string }> {
  await selectRenderedCategory(category);

  const selectAll = await waitForControl(findSelectAllCheckbox);
  if (!selectAll) {
    return { status: 'failed', message: 'Facebook All selector was not found' };
  }

  if (
    selectAll.getAttribute('aria-checked') !== 'true' &&
    !(selectAll as HTMLInputElement).checked
  ) {
    selectAll.click();
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  if (dryRun) {
    return { status: 'success', message: 'Dry run selected all visible Facebook activity' };
  }

  const removeButton = await waitForControl(findRemoveAllButton);
  if (!removeButton) {
    return { status: 'failed', message: 'Facebook Remove button was not found' };
  }

  removeButton.click();
  await new Promise((resolve) => setTimeout(resolve, 800));

  const confirmation = await waitForControl(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"] [role="button"], [role="dialog"] button'),
    );
    return buttons.find((button) => {
      const text = getElementText(button);
      return text.includes('remove') || text.includes('delete') || text.includes('confirm');
    }) || null;
  });
  confirmation?.click();

  return { status: 'success' };
}

function categorySearchTerms(category: ActivityCategory): string[] {
  switch (category) {
    case FacebookCategory.LikesReactions:
      return ['likes and reactions', 'likes & reactions', 'liked posts'];
    case FacebookCategory.Comments:
      return ['comments'];
    case FacebookCategory.Posts:
      return ['posts', 'photos and videos', 'posts, photos and videos'];
    case FacebookCategory.PageLikes:
      return ['page likes'];
    case FacebookCategory.Follows:
      return ['follows', 'following'];
    default:
      return [];
  }
}

function findCategoryControl(category: ActivityCategory): HTMLElement | null {
  const terms = categorySearchTerms(category);
  const controls = Array.from(
    document.querySelectorAll<HTMLElement>(
      'a, button, [role="button"], [role="link"], [role="tab"], [role="menuitem"]',
    ),
  );

  return (
    controls.find((control) => {
      if (!isVisible(control)) return false;
      const text = getElementText(control);
      return terms.some((term) => text === term || text.includes(term));
    }) || null
  );
}

function isSelectedCategoryControl(control: HTMLElement): boolean {
  const attributes = [
    control.getAttribute('aria-current'),
    control.getAttribute('aria-selected'),
    control.getAttribute('data-active'),
    control.getAttribute('data-state'),
  ]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());

  if (attributes.some((value) => ['page', 'true', 'active', 'selected'].includes(value))) {
    return true;
  }

  return /\b(active|selected|current)\b/i.test(control.className);
}

function hasActivityCategoryHeading(
  category: ActivityCategory,
  selectAll: HTMLElement | null,
): boolean {
  if (!selectAll) return false;
  const terms = categorySearchTerms(category);
  const headings = Array.from(
    document.querySelectorAll<HTMLElement>('h1, h2, h3, [role="heading"]'),
  ).filter(isVisible);

  return headings.some((heading) => {
    const text = getElementText(heading);
    if (!terms.some((term) => text === term || text.includes(term))) return false;

    let current: HTMLElement | null = heading;
    for (let depth = 0; current && depth < 8; depth++, current = current.parentElement) {
      if (current.contains(selectAll)) return true;
    }
    return false;
  });
}

function getActivityContext(category?: ActivityCategory): {
  platform: 'facebook' | 'messenger' | 'unknown';
  url: string;
  page: 'activity-category' | 'activity-default' | 'other';
  categorySelected: boolean;
} {
  const platform = detectPlatform();
  if (platform !== 'facebook') {
    return {
      platform,
      url: window.location.href,
      page: platform === 'messenger' ? 'other' : 'other',
      categorySelected: false,
    };
  }

  const currentUrl = new URL(window.location.href);
  const control = category ? findCategoryControl(category) : null;
  const controlState = control ? isSelectedCategoryControl(control) : false;
  const activityHeading = category
    ? hasActivityCategoryHeading(category, findSelectAllCheckbox())
    : false;
  // Facebook can preserve category_key in the URL while rendering the
  // general Activity Log. Treat the rendered control state as authoritative.
  const categorySelected = Boolean((control && controlState) || activityHeading);

  if (!isActivityLogUrl(currentUrl)) {
    return {
      platform,
      url: currentUrl.href,
      page: 'other',
      categorySelected: false,
    };
  }

  return {
    platform,
    url: currentUrl.href,
    page: categorySelected ? 'activity-category' : 'activity-default',
    categorySelected,
  };
}

async function selectRenderedCategory(category: ActivityCategory): Promise<void> {
  if (category === MessengerCategory.Conversations) return;

  const control = await waitForControl(() => findCategoryControl(category));
  if (!control) {
    logger.warn('Activity category control was not found; continuing with URL-selected view', {
      context: { category },
    });
    return;
  }

  const currentState = control.getAttribute('aria-current') || control.getAttribute('aria-selected');
  if (currentState === 'page' || currentState === 'true') return;

  control.click();
  await new Promise((resolve) => setTimeout(resolve, AUTOMATION_SETTLE_DELAY_MS));
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

  await waitForActivityItemsToLoad(FacebookCategory.LikesReactions);
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
    case 'GET_PROFILE_CONTEXT':
      return { profileId: getProfileIdFromPage(), url: window.location.href };

    case 'GET_ACTIVITY_CONTEXT':
      return getActivityContext(msg['category'] as ActivityCategory | undefined);

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
        await selectRenderedCategory(category);
        await waitForActivityItemsToLoad(category);
        items = await fbAdapter.scanActivity(category);
      }

      await chrome.storage.local.set({
        cleanslate_scan_progress: {
          status: 'complete',
          phase: 'Scan complete',
          detail: 'Activity is ready for review.',
          loadedItems: items.length,
          items,
          category,
          updatedAt: Date.now(),
        },
      });

      return {
        status: 'success',
        items: [...items],
      };
    }

    case 'BULK_CLEANUP': {
      const category = (msg['category'] as ActivityCategory) || FacebookCategory.Comments;
      const dryRun = msg['dryRun'] === true;
      const result = await runFacebookBulkCleanup(category, dryRun);
      return result;
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
