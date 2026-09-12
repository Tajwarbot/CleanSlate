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
    '[data-message-id]',
    '[data-testid*="message"]',
    '[role="main"] [role="row"]',
    'main [role="listitem"]',
  ],
  optionsButton: [
    '[aria-label="Menu"]',
    '[aria-label="More options"]',
    '[aria-label*="conversation"]',
    'div[role="button"][aria-haspopup="menu"]',
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
    '[role="dialog"] [role="button"][aria-label*="Delete"]',
    '[role="dialog"] [role="button"][tabindex="0"]',
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

      const main = document.querySelector('main, [role="main"]');
      if (!main) return [];

      const elements = this.findAllElements(SELECTORS.messageItem).filter((element) => {
        if (!main.contains(element)) return false;
        if (element.closest('[role="navigation"], [role="grid"], [aria-label="Chats"]')) return false;
        return Boolean((element.textContent || '').trim());
      });

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

      const optionsBtn = this.findFirstChild(targetMessage, SELECTORS.optionsButton) as HTMLElement | null;
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

      const menuItems = this.findAllChildElements(menu, SELECTORS.menuItems);
      let deleteBtn: HTMLElement | null = null;

      for (const mi of menuItems) {
        if (!mi) continue;
        const text = (mi.textContent || mi.getAttribute('aria-label') || '').toLowerCase();
        if (text.includes('delete') || text.includes('remove')) {
          deleteBtn = mi as HTMLElement;
          break;
        }
      }

      if (!deleteBtn && menuItems.length > 0 && menuItems[menuItems.length - 1]) {
        deleteBtn = menuItems[menuItems.length - 1] as HTMLElement;
      }

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
      await delayWithJitter(600);

      const dialog = this.findFirstElement(SELECTORS.confirmModal);
      if (dialog) {
        const confirmBtn = this.findFirstChild(dialog, SELECTORS.confirmButton) as HTMLElement | null;
        if (confirmBtn) {
          confirmBtn.click();
          await delayWithJitter(600);
        }
      }

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

  private findAllChildElements(parent: Element, selectors: readonly string[]): Element[] {
    for (const sel of selectors) {
      try {
        const els = Array.from(parent.querySelectorAll(sel));
        if (els.length > 0) return els;
      } catch {
        // Skip invalid selector
      }
    }
    return [];
  }
}
