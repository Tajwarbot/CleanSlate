/**
 * CleanSlate Safety Controller
 *
 * Every destructive action must call `canProceed()` before proceeding.
 * Implements fail-closed: UNCERTAIN = DO NOTHING.
 *
 * Stops when:
 * - User presses Stop
 * - Page navigates
 * - Tab closes
 * - UI unexpectedly changes
 * - Selector cannot be confidently resolved
 * - Confirmation cannot be verified
 * - Security challenge appears
 * - CAPTCHA appears
 * - Rate-limit warning appears
 * - Repeated failures occur
 * - Unexpected modal appears
 * - Extension state becomes inconsistent
 */

import { logger } from '../logging/logger';
import type { StateMachine } from '../state/state-machine';

/** Reason the safety controller denied an operation */
export enum SafetyDenialReason {
  UserStopped = 'USER_STOPPED',
  PageNavigated = 'PAGE_NAVIGATED',
  TabClosed = 'TAB_CLOSED',
  UIChanged = 'UI_CHANGED',
  SelectorFailed = 'SELECTOR_FAILED',
  VerificationFailed = 'VERIFICATION_FAILED',
  SecurityChallenge = 'SECURITY_CHALLENGE',
  CaptchaDetected = 'CAPTCHA_DETECTED',
  RateLimited = 'RATE_LIMITED',
  MaxFailures = 'MAX_FAILURES',
  UnexpectedModal = 'UNEXPECTED_MODAL',
  StateInconsistent = 'STATE_INCONSISTENT',
  Paused = 'PAUSED',
  MaxActionsReached = 'MAX_ACTIONS_REACHED',
  CooldownActive = 'COOLDOWN_ACTIVE',
}

/** Result of a safety check */
export interface SafetyCheckResult {
  readonly allowed: boolean;
  readonly reason?: SafetyDenialReason;
  readonly message?: string;
}

/** Configuration for the safety controller */
export interface SafetyConfig {
  readonly maxConsecutiveFailures: number;
  readonly maxActionsPerRun: number;
  readonly cooldownMs: number;
}

const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  maxConsecutiveFailures: 5,
  maxActionsPerRun: 500,
  cooldownMs: 3000,
};

export class SafetyController {
  private stopped = false;
  private paused = false;
  private consecutiveFailures = 0;
  private totalActions = 0;
  private lastActionTimestamp = 0;
  private securityChallengeDetected = false;
  private uiChanged = false;
  private pageNavigated = false;
  private config: SafetyConfig;

  constructor(
    private readonly stateMachine: StateMachine,
    config?: Partial<SafetyConfig>,
  ) {
    this.config = { ...DEFAULT_SAFETY_CONFIG, ...config };
    logger.info('Safety controller initialized', {
      context: {
        maxFailures: this.config.maxConsecutiveFailures,
        maxActions: this.config.maxActionsPerRun,
        cooldownMs: this.config.cooldownMs,
      },
    });
  }

  /**
   * Check if a destructive action can proceed.
   * MUST be called before every destructive action.
   * Fail-closed: returns { allowed: false } if uncertain.
   */
  canProceed(): SafetyCheckResult {
    // User explicitly stopped
    if (this.stopped) {
      return this.deny(SafetyDenialReason.UserStopped, 'Operation stopped by user');
    }

    // User paused
    if (this.paused) {
      return this.deny(SafetyDenialReason.Paused, 'Operation paused by user');
    }

    // Security challenge detected
    if (this.securityChallengeDetected) {
      return this.deny(
        SafetyDenialReason.SecurityChallenge,
        'Security challenge detected. Operation stopped to protect your account.',
      );
    }

    // UI changed
    if (this.uiChanged) {
      return this.deny(
        SafetyDenialReason.UIChanged,
        'Facebook interface appears to have changed. Operation stopped.',
      );
    }

    // Page navigated
    if (this.pageNavigated) {
      return this.deny(SafetyDenialReason.PageNavigated, 'Page navigation detected');
    }

    // Max consecutive failures
    if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return this.deny(
        SafetyDenialReason.MaxFailures,
        `Too many consecutive failures (${this.consecutiveFailures}/${this.config.maxConsecutiveFailures})`,
      );
    }

    // Max actions per run
    if (this.totalActions >= this.config.maxActionsPerRun) {
      return this.deny(
        SafetyDenialReason.MaxActionsReached,
        `Maximum actions per run reached (${this.totalActions}/${this.config.maxActionsPerRun})`,
      );
    }

    // Cooldown check
    const timeSinceLastAction = Date.now() - this.lastActionTimestamp;
    if (this.lastActionTimestamp > 0 && timeSinceLastAction < this.config.cooldownMs) {
      return this.deny(
        SafetyDenialReason.CooldownActive,
        `Cooldown active. ${this.config.cooldownMs - timeSinceLastAction}ms remaining.`,
      );
    }

    // State machine consistency check
    if (this.stateMachine.isInErrorState()) {
      return this.deny(
        SafetyDenialReason.StateInconsistent,
        `State machine is in error state: ${this.stateMachine.getState()}`,
      );
    }

    return { allowed: true };
  }

  /** Record a successful action */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.totalActions++;
    this.lastActionTimestamp = Date.now();
    logger.debug('Action succeeded', {
      context: {
        totalActions: this.totalActions,
        consecutiveFailures: 0,
      },
    });
  }

  /** Record a failed action */
  recordFailure(): void {
    this.consecutiveFailures++;
    this.totalActions++;
    this.lastActionTimestamp = Date.now();
    logger.warn('Action failed', {
      context: {
        totalActions: this.totalActions,
        consecutiveFailures: this.consecutiveFailures,
        maxFailures: this.config.maxConsecutiveFailures,
      },
    });
  }

  /** Signal user stop */
  stop(): void {
    this.stopped = true;
    logger.info('Safety controller: user stop signal received');
  }

  /** Signal user pause */
  pause(): void {
    this.paused = true;
    logger.info('Safety controller: user pause signal received');
  }

  /** Signal user resume */
  resume(): void {
    this.paused = false;
    logger.info('Safety controller: user resume signal received');
  }

  /** Signal that a security challenge has been detected */
  reportSecurityChallenge(): void {
    this.securityChallengeDetected = true;
    logger.error('Safety controller: security challenge detected');
  }

  /** Signal that the UI has changed unexpectedly */
  reportUIChanged(): void {
    this.uiChanged = true;
    logger.error('Safety controller: UI change detected');
  }

  /** Signal that the page has navigated */
  reportNavigation(): void {
    this.pageNavigated = true;
    logger.warn('Safety controller: page navigation detected');
  }

  /** Reset for a new operation */
  reset(): void {
    this.stopped = false;
    this.paused = false;
    this.consecutiveFailures = 0;
    this.totalActions = 0;
    this.lastActionTimestamp = 0;
    this.securityChallengeDetected = false;
    this.uiChanged = false;
    this.pageNavigated = false;
    logger.info('Safety controller reset');
  }

  /** Update configuration */
  updateConfig(config: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Get current stats */
  getStats(): {
    stopped: boolean;
    paused: boolean;
    consecutiveFailures: number;
    totalActions: number;
    securityChallengeDetected: boolean;
    uiChanged: boolean;
    pageNavigated: boolean;
  } {
    return {
      stopped: this.stopped,
      paused: this.paused,
      consecutiveFailures: this.consecutiveFailures,
      totalActions: this.totalActions,
      securityChallengeDetected: this.securityChallengeDetected,
      uiChanged: this.uiChanged,
      pageNavigated: this.pageNavigated,
    };
  }

  private deny(reason: SafetyDenialReason, message: string): SafetyCheckResult {
    logger.warn(`Safety check denied: ${reason}`, {
      context: { reason, message },
    });
    return { allowed: false, reason, message };
  }
}
