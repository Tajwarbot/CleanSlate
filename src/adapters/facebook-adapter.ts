/**
 * CleanSlate Facebook Activity Log Adapter
 *
 * Implements resilient, layered DOM discovery and action execution for Facebook Activity Log.
 * Selector Hierarchy:
 * 1. Accessible names & roles (aria-label, role="row", role="article", role="button")
 * 2. Semantic data attributes (data-pagelet, data-testid)
 * 3. Text content matching (localized action names)
 * 4. Fallback structural relationships
 */

import {
  ActionStatus,
  CapabilityStatus,
  FacebookCategory,
  type ActivityCategory,
  type Capability,
} from '../types/common';
import type {
  ActionResult,
  CleanupItem,
  Preview,
  ValidationResult,
  VerificationResult,
} from '../types/operations';
import type { FacebookAdapter, DetectedCapabilities } from './types';
import { logger } from '../core/logging/logger';
import { generateItemId } from '../utils/id';
import { delayWithJitter } from '../utils/delays';

/** DOM Selector definitions for Activity Log elements */
const SELECTORS = {
  activityLogContainer: [
    '[role="main"]',
    '[data-pagelet="ProfileActivityLog"]',
    '[data-pagelet="ActivityLogFeed"]',
    'div[role="feed"]',
  ],
  activityItem: [
    '[role="row"]',
    '[role="article"]',
    '[data-pagelet*="ActivityLog"]',
    'div[role="feed"] > div',
  ],
  optionsButton: [
    '[aria-label="Actions for this item"]',
    '[aria-label="Action options"]',
    '[aria-label*="Action" i]',
    '[aria-label="Edit"]',
    '[aria-label="Options"]',
    '[aria-label="More options"]',
    '[aria-label*="Option" i]',
    '[aria-label="More"]',
    'div[role="button"][aria-haspopup="menu"]',
    'div[role="button"][aria-haspopup="true"]',
  ],
  menuContainer: [
    '[role="menu"]',
    'div[aria-label="Menu"]',
    'div[data-pagelet="Flyout"]',
  ],
  menuItems: [
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    'div[role="button"]',
  ],
  confirmModal: [
    '[role="dialog"]',
    'div[aria-label*="Delete"]',
    'div[aria-label*="Trash"]',
  ],
  confirmButton: [
    '[role="dialog"] [role="button"][aria-label*="Delete"]',
    '[role="dialog"] [role="button"][aria-label*="Move"]',
    '[role="dialog"] [role="button"][aria-label*="Remove"]',
    '[role="dialog"] [role="button"][tabindex="0"]',
  ],
  securityChallenge: [
    '[id*="checkpoint"]',
    '[class*="checkpoint"]',
    'iframe[src*="captcha"]',
    '[data-testid="security_check"]',
  ],
  rateLimitNotice: [
    'div[role="alert"]',
    '[aria-label*="Temporarily Blocked"]',
    '[aria-label*="restricted"]',
  ],
} as const;

export class LiveFacebookAdapter implements FacebookAdapter {
  async detectCapabilities(): Promise<DetectedCapabilities> {
    const isFb = window.location.hostname.includes('facebook.com');

    const capabilities: Capability[] = isFb
      ? [
          {
            category: FacebookCategory.LikesReactions,
            status: CapabilityStatus.Supported,
            detectedAt: Date.now(),
          },
          {
            category: FacebookCategory.Comments,
            status: CapabilityStatus.Supported,
            detectedAt: Date.now(),
          },
        ]
      : [];

    return {
      platform: isFb ? 'facebook' : 'unknown',
      capabilities,
      detectedAt: Date.now(),
    };
  }

  async getCategoryStatus(_category: ActivityCategory): Promise<CapabilityStatus> {
    const isActivityPage =
      window.location.href.includes('allactivity') ||
      window.location.href.includes('your_information') ||
      Boolean(this.findFirstElement(SELECTORS.activityLogContainer));

    return isActivityPage ? CapabilityStatus.Supported : CapabilityStatus.Unavailable;
  }

  /**
   * Resilient, language-independent discovery of Facebook Activity Log items.
   * Leverages 3-dots action buttons, checkboxes, and structural DOM inspection.
   */
  private findActivityElements(): { row: Element; optionsBtn?: HTMLElement; checkbox?: HTMLElement }[] {
    const results: { row: Element; optionsBtn?: HTMLElement; checkbox?: HTMLElement }[] = [];

    // Strategy 1: Find by action buttons (3-dots options menu on each activity entry)
    const candidateButtons: HTMLElement[] = [];
    const btnSelectors = [
      'div[role="button"][aria-haspopup="menu"]',
      'div[role="button"][aria-haspopup="true"]',
      'div[role="button"][aria-haspopup]',
      '[aria-haspopup="menu"]',
      '[aria-label*="Action" i]',
      '[aria-label*="Option" i]',
      '[aria-label*="More" i]',
      '[aria-label*="Edit" i]',
    ];

    for (const sel of btnSelectors) {
      try {
        const found = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
        for (const btn of found) {
          if (btn.closest('header') || btn.closest('nav') || btn.closest('[role="navigation"]')) continue;
          if (!candidateButtons.includes(btn)) {
            candidateButtons.push(btn);
          }
        }
      } catch {
        // Skip
      }
    }

    // Language-independent check: buttons containing 3-dot SVG circles
    try {
      const allDivButtons = Array.from(document.querySelectorAll('div[role="button"]')) as HTMLElement[];
      for (const btn of allDivButtons) {
        if (btn.closest('header') || btn.closest('nav') || btn.closest('[role="navigation"]')) continue;
        if (btn.querySelector('svg circle') && !candidateButtons.includes(btn)) {
          candidateButtons.push(btn);
        }
      }
    } catch {
      // Skip
    }

    for (const btn of candidateButtons) {
      let current: HTMLElement | null = btn.parentElement;
      let rowEl: HTMLElement = btn;
      while (current && current !== document.body && current.getAttribute('role') !== 'main') {
        const text = current.textContent?.trim() || '';
        if (text.length > 8 && text.length < 2500) {
          rowEl = current;
          if (current.parentElement && current.parentElement.children.length > 1) {
            break;
          }
        }
        current = current.parentElement;
      }

      if (!results.some((r) => r.row === rowEl)) {
        results.push({ row: rowEl, optionsBtn: btn });
      }
    }

    if (results.length > 0) {
      console.log(`[CleanSlate] Discovered ${results.length} activity items via action buttons`);
      return results;
    }

    // Strategy 2: Find by checkboxes (Facebook Activity Log multi-select view)
    try {
      const checkboxes = Array.from(document.querySelectorAll('div[role="checkbox"], input[type="checkbox"]')) as HTMLElement[];
      for (const cb of checkboxes) {
        if (cb.closest('header') || cb.closest('nav') || cb.closest('[role="navigation"]')) continue;
        let current: HTMLElement | null = cb.parentElement;
        let rowEl: HTMLElement = cb;
        while (current && current !== document.body && current.getAttribute('role') !== 'main') {
          const text = current.textContent?.trim() || '';
          if (text.length > 8 && text.length < 2500) {
            rowEl = current;
            if (current.parentElement && current.parentElement.children.length > 1) {
              break;
            }
          }
          current = current.parentElement;
        }
        if (!results.some((r) => r.row === rowEl)) {
          const btn = rowEl.querySelector('div[role="button"][aria-haspopup], [aria-label*="Action" i]') as HTMLElement | null;
          results.push({ row: rowEl, optionsBtn: btn || undefined, checkbox: cb });
        }
      }
    } catch {
      // Skip
    }

    if (results.length > 0) {
      console.log(`[CleanSlate] Discovered ${results.length} activity items via checkboxes`);
      return results;
    }

    // Strategy 3: Structural container fallback
    const structuralSelectors = [
      '[role="row"]',
      '[role="article"]',
      '[role="listitem"]',
      '[data-pagelet*="ActivityLog"]',
      'div[role="feed"] > div',
    ];

    for (const sel of structuralSelectors) {
      try {
        const found = Array.from(document.querySelectorAll(sel));
        const meaningful = found.filter((el) => {
          if (el.closest('header') || el.closest('nav') || el.closest('[role="navigation"]')) return false;
          const text = el.textContent?.trim() || '';
          return text.length > 15 && text.length < 3000;
        });
        if (meaningful.length > 0) {
          for (const el of meaningful) {
            const btn = el.querySelector('div[role="button"][aria-haspopup], [aria-label*="Action" i]') as HTMLElement | null;
            results.push({ row: el, optionsBtn: btn || undefined });
          }
          console.log(`[CleanSlate] Discovered ${results.length} activity items via selector: ${sel}`);
          return results;
        }
      } catch {
        // Skip
      }
    }

    return results;
  }

  async scanActivity(category: ActivityCategory): Promise<ReadonlyArray<CleanupItem>> {
    console.log(`[CleanSlate] Scanning Facebook URL: ${window.location.href} for category: ${category}`);
    logger.info('Scanning Facebook activity items', { context: { category, url: window.location.href } });

    const items: CleanupItem[] = [];
    const elements = this.findActivityElements();

    for (let i = 0; i < elements.length; i++) {
      const entry = elements[i];
      if (!entry) continue;

      const el = entry.row;
      const textContent = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const ariaLabel = el.getAttribute('aria-label') || '';
      const labelText = (ariaLabel || textContent).substring(0, 120) || `Facebook activity #${i + 1}`;

      items.push({
        id: generateItemId(),
        category,
        label: labelText,
        description: textContent.substring(0, 200),
        timestamp: this.extractTimestamp(el) || Date.now(),
        url: window.location.href,
        actionable: true,
      });
    }

    console.log(`[CleanSlate] Scan complete: ${items.length} items found.`);
    logger.info('Scan completed', { context: { category, itemsFound: items.length } });
    return items;
  }

  async preview(items: ReadonlyArray<CleanupItem>): Promise<Preview> {
    const category = items[0]?.category || FacebookCategory.Comments;
    return {
      category,
      totalItems: items.length,
      items: [...items],
      generatedAt: Date.now(),
    };
  }

  async validate(items: ReadonlyArray<CleanupItem>): Promise<ValidationResult> {
    const validCount = items.filter((item) => item.actionable).length;
    return {
      valid: validCount === items.length,
      errors: validCount === items.length ? [] : ['Some items are not actionable in DOM'],
      warnings: [],
      itemCount: items.length,
    };
  }

  async execute(item: CleanupItem): Promise<ActionResult> {
    const startTime = Date.now();
    logger.info('Executing action on item', { context: { itemId: item.id } });

    if (await this.detectSecurityChallenge()) {
      return {
        itemId: item.id,
        status: ActionStatus.Failed,
        message: 'Security challenge detected on page',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
      };
    }

    if (await this.detectRateLimit()) {
      return {
        itemId: item.id,
        status: ActionStatus.Failed,
        message: 'Rate limit / temp block detected on page',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const detected = this.findActivityElements();
      let targetRow: Element | null = null;
      let targetOptionsBtn: HTMLElement | null = null;

      for (const d of detected) {
        const text = d.row.textContent || '';
        if (text.includes(item.label.substring(0, 25)) || item.label.includes(text.substring(0, 25))) {
          targetRow = d.row;
          targetOptionsBtn = d.optionsBtn || null;
          break;
        }
      }

      if (!targetRow && detected.length > 0 && detected[0]) {
        targetRow = detected[0].row;
        targetOptionsBtn = detected[0].optionsBtn || null;
      }

      if (!targetRow) {
        return {
          itemId: item.id,
          status: ActionStatus.Failed,
          message: 'DOM element not found on page',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
        };
      }

      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await delayWithJitter(400);

      const optionsBtn =
        targetOptionsBtn ||
        (this.findFirstChild(targetRow, SELECTORS.optionsButton) as HTMLElement | null) ||
        (targetRow.querySelector('div[role="button"]') as HTMLElement | null);

      if (!optionsBtn) {
        return {
          itemId: item.id,
          status: ActionStatus.Failed,
          message: 'Options button not found on element',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
        };
      }

      optionsBtn.click();
      await delayWithJitter(600);

      const menu = this.findFirstElement(SELECTORS.menuContainer);
      if (!menu) {
        return {
          itemId: item.id,
          status: ActionStatus.Failed,
          message: 'Context menu did not open',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
        };
      }

      const menuItems = this.findAllChildElements(menu, SELECTORS.menuItems);
      let actionBtn: HTMLElement | null = null;

      for (const mi of menuItems) {
        if (!mi) continue;
        const text = (mi.textContent || mi.getAttribute('aria-label') || '').toLowerCase();
        if (
          text.includes('trash') ||
          text.includes('delete') ||
          text.includes('remove') ||
          text.includes('unlike')
        ) {
          actionBtn = mi as HTMLElement;
          break;
        }
      }

      if (!actionBtn && menuItems.length > 0 && menuItems[menuItems.length - 1]) {
        actionBtn = menuItems[menuItems.length - 1] as HTMLElement;
      }

      if (!actionBtn) {
        return {
          itemId: item.id,
          status: ActionStatus.Failed,
          message: 'Target action not found in menu',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
        };
      }

      actionBtn.click();
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
        message: err instanceof Error ? err.message : 'DOM interaction failed',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
      };
    }
  }

  async verify(item: CleanupItem): Promise<VerificationResult> {
    const rows = this.findAllElements(SELECTORS.activityItem);
    const exists = rows.some((r) => r && r.textContent?.includes(item.label.substring(0, 30)));

    return {
      itemId: item.id,
      verified: !exists,
      status: !exists ? ActionStatus.Success : ActionStatus.Failed,
      message: !exists ? 'Element removed from DOM' : 'Element still visible in DOM',
      timestamp: Date.now(),
    };
  }

  async detectSecurityChallenge(): Promise<boolean> {
    return Boolean(this.findFirstElement(SELECTORS.securityChallenge));
  }

  async detectRateLimit(): Promise<boolean> {
    const alert = this.findFirstElement(SELECTORS.rateLimitNotice);
    if (!alert) return false;
    const text = alert.textContent?.toLowerCase() || '';
    return text.includes('blocked') || text.includes('temporarily') || text.includes('try again later');
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

  private extractTimestamp(el: Element): number | null {
    const timeEl = el.querySelector('time') || el.querySelector('[aria-label*="20"]');
    if (timeEl) {
      const datetime = timeEl.getAttribute('datetime');
      if (datetime) {
        const parsed = Date.parse(datetime);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return null;
  }
}
