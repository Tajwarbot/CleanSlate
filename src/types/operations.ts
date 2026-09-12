/**
 * Operation types for the CleanSlate cleanup engine.
 *
 * Implements the destructive-action model:
 * DISCOVER → SCAN → PREVIEW → USER SELECTION → CONFIRMATION → EXECUTE → VERIFY → COMPLETE
 */

import type { ActivityCategory, ActionStatus, ItemId, OperationId, Timestamp } from './common';

/** A single discoverable activity item */
export interface CleanupItem {
  readonly id: ItemId;
  readonly category: ActivityCategory;
  readonly label: string;
  readonly description?: string;
  readonly timestamp?: Timestamp;
  readonly url?: string;
  /** Whether the item can be safely acted upon */
  readonly actionable: boolean;
}

/** Result of executing an action on a single item */
export interface ActionResult {
  readonly itemId: ItemId;
  readonly status: ActionStatus;
  readonly message?: string;
  readonly timestamp: Timestamp;
  /** Duration in milliseconds */
  readonly durationMs: number;
}

/** Result of verifying an action */
export interface VerificationResult {
  readonly itemId: ItemId;
  readonly verified: boolean;
  readonly status: ActionStatus;
  readonly message?: string;
  readonly timestamp: Timestamp;
}

/** Preview of items before confirmation */
export interface Preview {
  readonly category: ActivityCategory;
  readonly totalItems: number;
  readonly items: ReadonlyArray<CleanupItem>;
  readonly generatedAt: Timestamp;
}

/** Validation result before execution */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly itemCount: number;
}

/** Statistics for an active operation */
export interface OperationStats {
  readonly operationId: OperationId;
  readonly category: ActivityCategory;
  readonly totalItems: number;
  readonly processedItems: number;
  readonly successCount: number;
  readonly failedCount: number;
  readonly skippedCount: number;
  readonly unknownCount: number;
  readonly currentBatch: number;
  readonly totalBatches: number;
  readonly startedAt: Timestamp;
  readonly elapsedMs: number;
  readonly estimatedRemainingMs?: number;
}

/** Final report after operation completes */
export interface CleanupReport {
  readonly operationId: OperationId;
  readonly category: ActivityCategory;
  readonly stats: OperationStats;
  readonly results: ReadonlyArray<ActionResult>;
  readonly verifications: ReadonlyArray<VerificationResult>;
  readonly startedAt: Timestamp;
  readonly completedAt: Timestamp;
  readonly durationMs: number;
  readonly stoppedByUser: boolean;
  readonly stoppedBySafety: boolean;
  readonly dryRun: boolean;
}

/** Cleanup operation interface — each activity type implements this */
export interface CleanupOperation {
  /** Discover available items for cleanup */
  discover(): Promise<ReadonlyArray<CleanupItem>>;
  /** Generate a preview of what will be cleaned */
  preview(items: ReadonlyArray<CleanupItem>): Promise<Preview>;
  /** Validate items before execution */
  validate(items: ReadonlyArray<CleanupItem>): Promise<ValidationResult>;
  /** Execute a single cleanup action */
  execute(item: CleanupItem): Promise<ActionResult>;
  /** Verify a single action was successful */
  verify(item: CleanupItem): Promise<VerificationResult>;
  /** Generate final report */
  report(): CleanupReport;
}
