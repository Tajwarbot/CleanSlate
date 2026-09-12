/**
 * CleanSlate Operation Scheduler
 *
 * Conservative batch scheduler for cleanup operations.
 * NOT an anti-detection system — exists for reliability,
 * user control, and avoiding uncontrolled bursts.
 *
 * Features:
 * - Bounded batch size
 * - Bounded delays with jitter
 * - Cooldowns between batches
 * - Cancellation support
 * - Exponential backoff after failures
 * - Maximum actions per run
 * - Automatic pauses
 */

import { logger } from '../logging/logger';
import type { SafetyController } from '../safety/safety-controller';

/** Scheduler configuration */
export interface SchedulerConfig {
  /** Number of items per batch */
  readonly batchSize: number;
  /** Base delay between actions within a batch (ms) */
  readonly baseDelayMs: number;
  /** Delay between batches (ms) */
  readonly batchCooldownMs: number;
  /** Maximum delay for exponential backoff (ms) */
  readonly maxBackoffMs: number;
  /** Jitter range as a fraction (0-1) added to delays */
  readonly jitterFraction: number;
  /** Maximum total actions in a single run */
  readonly maxActionsPerRun: number;
  /** Pause after this many batches to allow user review */
  readonly autoPauseAfterBatches: number;
}

const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  batchSize: 5,
  baseDelayMs: 1500,
  batchCooldownMs: 5000,
  maxBackoffMs: 30000,
  jitterFraction: 0.3,
  maxActionsPerRun: 500,
  autoPauseAfterBatches: 0, // 0 = disabled
};

/** Callback invoked for each item in a batch */
export type ItemProcessor<T> = (item: T) => Promise<boolean>;

/** Result of processing a batch */
export interface BatchResult {
  readonly batchIndex: number;
  readonly totalItems: number;
  readonly successCount: number;
  readonly failedCount: number;
  readonly skippedCount: number;
  readonly cancelled: boolean;
}

/** Result of a complete scheduled run */
export interface SchedulerResult {
  readonly batches: ReadonlyArray<BatchResult>;
  readonly totalProcessed: number;
  readonly totalSuccess: number;
  readonly totalFailed: number;
  readonly totalSkipped: number;
  readonly cancelled: boolean;
  readonly reason?: string;
}

export class Scheduler {
  private cancelled = false;
  private currentBackoffMs: number;
  private config: SchedulerConfig;
  private batchesCompleted = 0;

  constructor(
    private readonly safetyController: SafetyController,
    config?: Partial<SchedulerConfig>,
  ) {
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    this.currentBackoffMs = this.config.baseDelayMs;

    logger.info('Scheduler initialized', {
      context: {
        batchSize: this.config.batchSize,
        baseDelayMs: this.config.baseDelayMs,
        batchCooldownMs: this.config.batchCooldownMs,
        maxActions: this.config.maxActionsPerRun,
      },
    });
  }

  /**
   * Process items in batches with safety checks, delays, and backoff.
   *
   * @param items - Items to process
   * @param processor - Async function that processes a single item. Returns true for success.
   * @returns Complete result of the scheduled run
   */
  async processBatches<T>(
    items: ReadonlyArray<T>,
    processor: ItemProcessor<T>,
  ): Promise<SchedulerResult> {
    this.cancelled = false;
    this.batchesCompleted = 0;
    this.currentBackoffMs = this.config.baseDelayMs;

    const batches = this.createBatches(items);
    const batchResults: BatchResult[] = [];
    let totalProcessed = 0;

    logger.info('Starting batch processing', {
      context: {
        totalItems: items.length,
        totalBatches: batches.length,
        batchSize: this.config.batchSize,
      },
    });

    for (let i = 0; i < batches.length; i++) {
      // Safety check before each batch
      const safetyCheck = this.safetyController.canProceed();
      if (!safetyCheck.allowed) {
        logger.warn('Scheduler stopped by safety controller', {
          context: { reason: safetyCheck.reason ?? 'unknown', batch: i },
        });
        return this.buildResult(batchResults, true, safetyCheck.message);
      }

      if (this.cancelled) {
        return this.buildResult(batchResults, true, 'Cancelled by user');
      }

      // Check max actions
      if (totalProcessed >= this.config.maxActionsPerRun) {
        logger.info('Maximum actions per run reached', {
          context: { totalProcessed, max: this.config.maxActionsPerRun },
        });
        return this.buildResult(batchResults, false, 'Maximum actions per run reached');
      }

      // Auto-pause check
      if (
        this.config.autoPauseAfterBatches > 0 &&
        this.batchesCompleted > 0 &&
        this.batchesCompleted % this.config.autoPauseAfterBatches === 0
      ) {
        logger.info('Auto-pause triggered', {
          context: { batchesCompleted: this.batchesCompleted },
        });
        this.safetyController.pause();
        return this.buildResult(batchResults, false, 'Auto-pause after batch limit');
      }

      const batch = batches[i]!;
      const batchResult = await this.processSingleBatch(batch, i, processor);
      batchResults.push(batchResult);
      totalProcessed += batchResult.totalItems;
      this.batchesCompleted++;

      if (batchResult.cancelled) {
        return this.buildResult(batchResults, true, 'Batch cancelled');
      }

      // Cooldown between batches (not after the last one)
      if (i < batches.length - 1) {
        await this.delay(this.config.batchCooldownMs);
      }
    }

    return this.buildResult(batchResults, false);
  }

  /** Cancel the current operation */
  cancel(): void {
    this.cancelled = true;
    logger.info('Scheduler cancelled');
  }

  /** Check if the scheduler is cancelled */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /** Update configuration */
  updateConfig(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private createBatches<T>(items: ReadonlyArray<T>): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += this.config.batchSize) {
      batches.push(items.slice(i, i + this.config.batchSize));
    }
    return batches;
  }

  private async processSingleBatch<T>(
    batch: T[],
    batchIndex: number,
    processor: ItemProcessor<T>,
  ): Promise<BatchResult> {
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const item of batch) {
      // Safety check before each item
      const safetyCheck = this.safetyController.canProceed();
      if (!safetyCheck.allowed) {
        skippedCount += batch.length - (successCount + failedCount + skippedCount);
        return {
          batchIndex,
          totalItems: batch.length,
          successCount,
          failedCount,
          skippedCount,
          cancelled: true,
        };
      }

      if (this.cancelled) {
        skippedCount += batch.length - (successCount + failedCount + skippedCount);
        return {
          batchIndex,
          totalItems: batch.length,
          successCount,
          failedCount,
          skippedCount,
          cancelled: true,
        };
      }

      try {
        const success = await processor(item);
        if (success) {
          successCount++;
          this.safetyController.recordSuccess();
          this.currentBackoffMs = this.config.baseDelayMs; // Reset backoff on success
        } else {
          failedCount++;
          this.safetyController.recordFailure();
          this.currentBackoffMs = Math.min(
            this.currentBackoffMs * 2,
            this.config.maxBackoffMs,
          );
        }
      } catch {
        failedCount++;
        this.safetyController.recordFailure();
        this.currentBackoffMs = Math.min(this.currentBackoffMs * 2, this.config.maxBackoffMs);
      }

      // Delay between items (with jitter)
      await this.delay(this.currentBackoffMs);
    }

    return {
      batchIndex,
      totalItems: batch.length,
      successCount,
      failedCount,
      skippedCount,
      cancelled: false,
    };
  }

  private async delay(ms: number): Promise<void> {
    const jitter = ms * this.config.jitterFraction * (Math.random() * 2 - 1);
    const actualDelay = Math.max(100, Math.round(ms + jitter));
    return new Promise((resolve) => setTimeout(resolve, actualDelay));
  }

  private buildResult(
    batches: BatchResult[],
    cancelled: boolean,
    reason?: string,
  ): SchedulerResult {
    const totalProcessed = batches.reduce((sum, b) => sum + b.totalItems, 0);
    const totalSuccess = batches.reduce((sum, b) => sum + b.successCount, 0);
    const totalFailed = batches.reduce((sum, b) => sum + b.failedCount, 0);
    const totalSkipped = batches.reduce((sum, b) => sum + b.skippedCount, 0);

    logger.info('Scheduler run complete', {
      context: {
        totalProcessed,
        totalSuccess,
        totalFailed,
        totalSkipped,
        cancelled,
        batchCount: batches.length,
      },
    });

    return {
      batches,
      totalProcessed,
      totalSuccess,
      totalFailed,
      totalSkipped,
      cancelled,
      reason,
    };
  }
}
