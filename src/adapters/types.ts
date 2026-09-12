/**
 * Adapter interfaces for Facebook and Messenger.
 *
 * Adapters abstract the unstable external UI behind stable interfaces.
 * Use layered DOM discovery: accessible names → semantic roles →
 * stable attributes → visible text → DOM relationships → scoped selectors.
 */

import type { ActivityCategory, Capability, CapabilityStatus } from '../types/common';
import type {
  ActionResult,
  CleanupItem,
  Preview,
  ValidationResult,
  VerificationResult,
} from '../types/operations';

/** Capabilities detected on the current page */
export interface DetectedCapabilities {
  readonly platform: 'facebook' | 'messenger' | 'unknown';
  readonly capabilities: ReadonlyArray<Capability>;
  readonly detectedAt: number;
}

/** Facebook Activity Log adapter interface */
export interface FacebookAdapter {
  /** Detect what capabilities are available on the current page */
  detectCapabilities(): Promise<DetectedCapabilities>;

  /** Check if a specific category is supported */
  getCategoryStatus(category: ActivityCategory): Promise<CapabilityStatus>;

  /** Scan for activity items in the given category */
  scanActivity(category: ActivityCategory): Promise<ReadonlyArray<CleanupItem>>;

  /** Generate a preview of items */
  preview(items: ReadonlyArray<CleanupItem>): Promise<Preview>;

  /** Validate items before execution */
  validate(items: ReadonlyArray<CleanupItem>): Promise<ValidationResult>;

  /** Execute a single cleanup action (e.g., unlike, delete comment) */
  execute(item: CleanupItem): Promise<ActionResult>;

  /** Verify that the action was successful */
  verify(item: CleanupItem): Promise<VerificationResult>;

  /** Check if a security challenge is present */
  detectSecurityChallenge(): Promise<boolean>;

  /** Check if a rate-limit warning is present */
  detectRateLimit(): Promise<boolean>;
}

/** Messenger adapter interface */
export interface MessengerAdapter {
  /** Detect what capabilities are available */
  detectCapabilities(): Promise<DetectedCapabilities>;

  /** Discover conversations */
  discoverConversations(): Promise<ReadonlyArray<CleanupItem>>;

  /** Preview selected conversations for deletion */
  preview(items: ReadonlyArray<CleanupItem>): Promise<Preview>;

  /** Validate conversations before deletion */
  validate(items: ReadonlyArray<CleanupItem>): Promise<ValidationResult>;

  /** Delete a single conversation */
  execute(item: CleanupItem): Promise<ActionResult>;

  /** Verify that the conversation was deleted */
  verify(item: CleanupItem): Promise<VerificationResult>;

  /** Check if a security challenge is present */
  detectSecurityChallenge(): Promise<boolean>;

  /** Check if a rate-limit warning is present */
  detectRateLimit(): Promise<boolean>;
}
