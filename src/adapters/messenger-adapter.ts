/**
 * CleanSlate Messenger Adapter
 *
 * Implements resilient, layered DOM discovery and chat deletion for Messenger.
 * Selector Hierarchy:
 * 1. Accessible roles & labels (role="navigation", role="grid", aria-label="Chats")
 * 2. Semantic data attributes (data-testid="mwthreadlist_item")
 * 3. Fallback structural relationships
 */

import {
  ActionStatus,
  CapabilityStatus,
  MessengerCategory,
  type Capability,
} from '../types/common';
import type {
  ActionResult,
  CleanupItem,
  Preview,
  ValidationResult,
  VerificationResult,
} from '../types/operations';
import type { MessengerAdapter, DetectedCapabilities } from './types';
import { logger } from '../core/logging/logger';
import { generateItemId } from '../utils/id';
import { delayWithJitter } from '../utils/delays';

/** DOM Selector definitions for Messenger elements */
const SELECTORS = {
  threadListContainer: [
    '[role="navigation"]',
    '[role="grid"]',
    '[aria-label="Chats"]',
    '[data-pagelet="MWThreadList"]',
  ],
  threadItem: [
    '[role="row"]',
    '[data-testid="mwthreadlist_item"]',
    'div[role="navigation"] a[href*="/t/"]',
    'div[role="grid"] > div',
  ],
  messageItem: [
    '[role="row"]:has([data-scope="messages_table"])',
    '[role="row"].__fb-light-mode',
    '[role="row"].__fb-dark-mode',
    '[data-message-id]',
    '[data-testid*="message"]',
  ],
  optionsButton: [
    '[aria-label="More"]',
    '[aria-label="More options"]',
  ],
  menuContainer: [
    '[role="menu"]',
    'div[aria-label="Menu"]',
  ],
  menuItems: [
    '[role="menuitem"]',
    'div[role="button"]',
  ],
  confirmModal: [
    '[role="dialog"]',
    'div[aria-label*="Delete"]',
  ],
  confirmButton: [
    '[aria-label="Unsend"]:not([aria-disabled="true"])',
    '[aria-label="Remove"]:not([aria-disabled="true"])',
  ],
  securityChallenge: [
    '[id*="checkpoint"]',
    '[class*="checkpoint"]',
    'iframe[src*="captcha"]',
  ],
  rateLimitNotice: [
    'div[role="alert"]',
    '[aria-label*="Temporarily Blocked"]',
  ],
} as const;

export class LiveMessengerAdapter implements MessengerAdapter {
  private messageTargets = new Map<string, Element>();

  async cleanupOpenConversation(dryRun: boolean): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    const main = this.findConversationRoot();
    if (!main) return { processed: 0, successful: 0, failed: 0 };

    if (!(await this.loadOlderMessages(main))) {
      return { processed: 0, successful: 0, failed: 0 };
    }
    let successful = 0;
    let failed = 0;
    let stablePasses = 0;

    for (let pass = 0; pass < 120 && stablePasses < 5; pass++) {
      const rows = this.getMessageRows(main).reverse();
      if (rows.length === 0) break;

      let changed = false;
      for (const row of rows) {
        if (this.isUnsentPlaceholder(row)) continue;
        const item: CleanupItem = {
          id: generateItemId(),
          category: MessengerCategory.Conversations,
          label: this.messageLabel(row),
          description: 'Message in the currently open conversation',
          timestamp: Date.now(),
          url: window.location.href,
          actionable: true,
        };
        this.messageTargets.set(item.id, row);

        if (dryRun) {
          successful++;
          continue;
        }

        const result = await this.execute(item);
        if (result.status === ActionStatus.Success) {
          successful++;
          changed = true;
        } else {
          failed++;
        }
        await delayWithJitter(1800);
      }

      const beforeCount = rows.length;
      if (!(await this.loadOlderMessages(main))) break;
      const afterCount = this.getMessageRows(main).length;
      stablePasses = changed || afterCount !== beforeCount ? 0 : stablePasses + 1;
      if (dryRun) break;
    }

    return {
      processed: successful + failed,
      successful,
      failed,
    };
  }

  async detectCapabilities(): Promise<DetectedCapabilities> {
    const isMessenger =
      window.location.hostname.includes('messenger.com') ||
      window.location.pathname.includes('/messages');

    const capabilities: Capability[] = isMessenger
      ? [
          {
            category: MessengerCategory.Conversations,
            status: CapabilityStatus.Supported,
            detectedAt: Date.now(),
          },
        ]
      : [];

    return {
      platform: isMessenger ? 'messenger' : 'unknown',
      capabilities,
      detectedAt: Date.now(),
    };
  }

  async discoverConversations(): Promise<ReadonlyArray<CleanupItem>> {
    logger.info('Discovering Messenger conversations');

    const items: CleanupItem[] = [];
    const elements = this.findAllElements(SELECTORS.threadItem);

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!el) continue;

      const textContent = el.textContent || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const labelText = (ariaLabel || textContent).trim().substring(0, 100) || `Conversation #${i + 1}`;

      items.push({
        id: generateItemId(),
        category: MessengerCategory.Conversations,
        label: labelText,
        description: textContent.trim().substring(0, 150),
        timestamp: Date.now(),
        url: window.location.href,
        actionable: true,
      });
    }

    logger.info('Conversation discovery completed', { context: { count: items.length } });
    return items;
  }

    async discoverMessagesInOpenConversation(): Promise<ReadonlyArray<CleanupItem>> {
      logger.info('Discovering messages in the currently open Messenger conversation');

      const main = this.findConversationRoot();
      if (!main) return [];

        const elements = this.getMessageRows(main);

      this.messageTargets.clear();
      return elements.map((element, index) => {
        const label = (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160);
        const id = generateItemId();
        this.messageTargets.set(id, element);
        return {
          id,
          category: MessengerCategory.Conversations,
          label: label || `Message ${index + 1}`,
          description: 'Message in the currently open conversation',
          timestamp: Date.now(),
          url: window.location.href,
          actionable: true,
        };
      });
    }

  async preview(items: ReadonlyArray<CleanupItem>): Promise<Preview> {
    return {
      category: MessengerCategory.Conversations,
      totalItems: items.length,
      items: [...items],
      generatedAt: Date.now(),
    };
  }

  async validate(items: ReadonlyArray<CleanupItem>): Promise<ValidationResult> {
    return {
      valid: true,
      errors: [],
      warnings: [],
      itemCount: items.length,
    };
  }

  async execute(item: CleanupItem): Promise<ActionResult> {
    const startTime = Date.now();
    logger.info('Deleting Messenger message', { context: { itemId: item.id } });

    if (await this.detectSecurityChallenge()) {
      return {
        itemId: item.id,
        status: ActionStatus.Failed,
        message: 'Security challenge detected',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const targetMessage = this.messageTargets.get(item.id) ||
        this.findAllElements(SELECTORS.messageItem).find((element) =>
          element.textContent?.includes(item.label.substring(0, 20)),
        ) || null;

      if (!targetMessage) {
        return {
          itemId: item.id,
          status: ActionStatus.Failed,
          message: 'Message element in the open conversation was not found',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
        };
      }

      targetMessage.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await delayWithJitter(400);

      const optionsBtn = this.findMessageOptionsButton(targetMessage);
      if (!optionsBtn) {
        return {
          itemId: item.id,
          status: ActionStatus.Failed,
          message: 'Message menu button not found',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
        };
      }

      optionsBtn.click();
      await delayWithJitter(500);

      const menu = this.findFirstElement(SELECTORS.menuContainer);
      if (!menu) {
        return {
          itemId: item.id,
          status: ActionStatus.Failed,
          message: 'Messenger menu did not open',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
        };
      }

      const deleteBtn = this.findFirstElement([
        '[aria-label="Remove message"]',
        '[aria-label="Remove Message"]',
        '[aria-label="Unsend Message"]',
        '[aria-label="Unsend message"]',
      ]) as HTMLElement | null;

      if (!deleteBtn) {
        return {
          itemId: item.id,
          status: ActionStatus.Failed,
          message: 'Delete message action not found in menu',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
        };
      }

      deleteBtn.click();
      await delayWithJitter(900);

      const confirmBtn = this.findFirstElement(SELECTORS.confirmButton) as HTMLElement | null;
      if (!confirmBtn) {
        this.dismissOpenMenu();
        return {
          itemId: item.id,
          status: ActionStatus.Failed,
          message: 'Messenger removal confirmation was not found',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
        };
      }
      confirmBtn.click();
      await delayWithJitter(1600);

      return {
        itemId: item.id,
        status: ActionStatus.Success,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        itemId: item.id,
        status: ActionStatus.Failed,
        message: err instanceof Error ? err.message : 'Messenger interaction failed',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
      };
    }
  }

  async verify(item: CleanupItem): Promise<VerificationResult> {
    const exists = this.findAllElements(SELECTORS.messageItem).some((message) =>
      message.textContent?.includes(item.label.substring(0, 20)),
    );

    return {
      itemId: item.id,
      verified: !exists,
      status: !exists ? ActionStatus.Success : ActionStatus.Failed,
      message: !exists ? 'Message deleted' : 'Message still present',
      timestamp: Date.now(),
    };
  }

  async detectSecurityChallenge(): Promise<boolean> {
    return Boolean(this.findFirstElement(SELECTORS.securityChallenge));
  }

  async detectRateLimit(): Promise<boolean> {
    return Boolean(this.findFirstElement(SELECTORS.rateLimitNotice));
  }

  private findFirstElement(selectors: readonly string[]): Element | null {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch {
        // Skip invalid selector
      }
    }
    return null;
  }

  private findAllElements(selectors: readonly string[]): Element[] {
    for (const sel of selectors) {
      try {
        const els = Array.from(document.querySelectorAll(sel));
        if (els.length > 0) return els;
      } catch {
        // Skip invalid selector
      }
    }
    return [];
  }

  private findFirstChild(parent: Element, selectors: readonly string[]): Element | null {
    for (const sel of selectors) {
      try {
        const el = parent.querySelector(sel);
        if (el) return el;
      } catch {
        // Skip invalid selector
      }
    }
    return null;
  }

  private getAccessibleText(element: Element): string {
    return (
      element.getAttribute('aria-label') ||
      element.textContent ||
      ''
    ).replace(/\s+/g, ' ').trim();
  }

  private getMessageRows(main: Element): Element[] {
    const candidates = SELECTORS.messageItem.flatMap((selector) => {
      try {
        return Array.from(document.querySelectorAll(selector));
      } catch {
        return [];
      }
    });
    return [...new Set(candidates)].filter((element) => {
      if (!main.contains(element)) return false;
      if (element.closest('[role="navigation"], [aria-label="Chats"]')) return false;
      return Boolean((element.textContent || '').trim()) && !this.isUnsentPlaceholder(element);
    });
  }

  private findConversationRoot(): Element | null {
    const candidates = Array.from(document.querySelectorAll('main, [role="main"]'));
    const ranked = candidates
      .map((candidate) => ({ candidate, count: this.countMessageRows(candidate) }))
      .filter(({ count }) => count > 0)
      .sort((a, b) => b.count - a.count);
    return ranked[0]?.candidate || null;
  }

  private countMessageRows(root: Element): number {
    return SELECTORS.messageItem.reduce((count, selector) => {
      try {
        return count + root.querySelectorAll(selector).length;
      } catch {
        return count;
      }
    }, 0);
  }

  private messageLabel(element: Element): string {
    return (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160) || 'Message';
  }

  private isUnsentPlaceholder(element: Element): boolean {
    return this.getAccessibleText(element) === 'You unsent a message';
  }

  private findMessageOptionsButton(message: Element): HTMLElement | null {
    let current: Element | null = message;
    for (let depth = 0; current && depth < 8; depth++, current = current.parentElement) {
      const button = this.findFirstChild(current, SELECTORS.optionsButton);
      if (button instanceof HTMLElement) return button;
    }

    const visibleButtons = Array.from(document.querySelectorAll<HTMLElement>('[aria-label]')).filter((button) => {
      if (!button.isConnected || button.getClientRects().length === 0) return false;
      const label = this.getAccessibleText(button).toLowerCase();
      return label === 'more' || label === 'more options';
    });

    return visibleButtons.find((button) => {
      let parent: Element | null = button;
      for (let depth = 0; parent && depth < 8; depth++, parent = parent.parentElement) {
        if (parent === message) return true;
      }
      return false;
    }) || null;
  }

  private async loadOlderMessages(main: Element): Promise<boolean> {
    const scrollContainer = this.findMessageScrollContainer(main);
    if (!scrollContainer) return true;

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    await delayWithJitter(1200);

    let stablePasses = 0;
    let previousHeight = scrollContainer.scrollHeight;
    let previousCount = this.findAllElements(SELECTORS.messageItem).filter((element) =>
      main.contains(element),
    ).length;

    for (let pass = 0; pass < 120; pass++) {
      if (await this.shouldStop()) return false;
      scrollContainer.scrollTop = 0;
      scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));

      let loading = true;
      for (let wait = 0; wait < 8; wait++) {
        await delayWithJitter(700);
        loading = Boolean(document.querySelector('[role="main"] svg[aria-valuetext="Loading..."]'));
        if (!loading) break;
      }

      const nextHeight = scrollContainer.scrollHeight;
      const nextCount = this.findAllElements(SELECTORS.messageItem).filter((element) =>
        main.contains(element),
      ).length;
      const changed = nextHeight !== previousHeight || nextCount !== previousCount;
      stablePasses = changed ? 0 : stablePasses + 1;
      previousHeight = nextHeight;
      previousCount = nextCount;
      if (stablePasses >= 5 && !loading) break;
    }
    return true;
  }

  private async shouldStop(): Promise<boolean> {
    const result = await chrome.storage.local.get('cleanslate_scan_control');
    const action = (result['cleanslate_scan_control'] as { action?: string } | undefined)?.action;
    return action === 'stop' || action === 'cancel';
  }

  private findMessageScrollContainer(main: Element): HTMLElement | null {
    const grid = main.querySelector('[role="grid"]');
    if (grid) {
      let current = grid.firstElementChild;
      while (current) {
        if (current instanceof HTMLElement) {
          const overflow = getComputedStyle(current).overflowY;
          if (
            (overflow === 'auto' || overflow === 'scroll') &&
            current.scrollHeight > current.clientHeight
          ) {
            return current;
          }
        }
        current = current.firstElementChild;
      }
    }

    const row = this.getMessageRows(main)[0] || null;
    let current: Element | null = row;
    while (current) {
      if (current instanceof HTMLElement) {
        const overflow = getComputedStyle(current).overflowY;
        if (
          (overflow === 'auto' || overflow === 'scroll') &&
          current.scrollHeight > current.clientHeight
        ) {
          return current;
        }
      }
      current = current.parentElement;
    }
    return null;
  }

  private dismissOpenMenu(): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }
}
