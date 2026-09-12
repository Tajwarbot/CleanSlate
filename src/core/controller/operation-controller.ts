/**
 * CleanSlate Operation Controller
 *
 * Orchestrates the full cleanup lifecycle:
 * DISCOVER → SCAN → PREVIEW → CONFIRM → EXECUTE → VERIFY → COMPLETE
 *
 * Coordinates between the state machine, safety controller,
 * scheduler, and cleanup operations.
 */

import type { ActivityCategory, OperationId } from '../../types/common';
import type {
  CleanupItem,
  CleanupReport,
  OperationStats,
  Preview,
} from '../../types/operations';
import { OperationState, StateEvent } from '../../types/state';
import { logger } from '../logging/logger';
import type { SafetyController } from '../safety/safety-controller';
import type { Scheduler } from '../scheduler/scheduler';
import type { StateMachine } from '../state/state-machine';

/** Generate a unique operation ID */
function generateOperationId(): OperationId {
  return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** The operation controller orchestrates cleanup workflows */
export class OperationController {
  private currentOperationId: OperationId | null = null;
  private currentCategory: ActivityCategory | null = null;
  private discoveredItems: CleanupItem[] = [];
  private selectedItems: CleanupItem[] = [];
  private results: { itemId: string; success: boolean }[] = [];
  private startedAt = 0;
  private dryRun = false;

  constructor(
    private readonly stateMachine: StateMachine,
    private readonly safetyController: SafetyController,
    private readonly scheduler: Scheduler,
  ) {
    logger.info('Operation controller initialized');
  }

  /** Get current operation ID */
  getOperationId(): OperationId | null {
    return this.currentOperationId;
  }

  /** Get current state */
  getState(): OperationState {
    return this.stateMachine.getState();
  }

  /** Start a scan for the given category */
  async startScan(
    category: ActivityCategory,
    _dryRun: boolean,
    scanFn: () => Promise<ReadonlyArray<CleanupItem>>,
  ): Promise<ReadonlyArray<CleanupItem>> {
    this.stateMachine.transition(StateEvent.StartScan);
    this.currentOperationId = generateOperationId();
    this.currentCategory = category;
    this.discoveredItems = [];
    this.selectedItems = [];
    this.results = [];
    this.dryRun = _dryRun;

    logger.info('Starting scan', {
      operationId: this.currentOperationId,
      category,
      context: { dryRun: _dryRun },
    });

    try {
      const items = await scanFn();
      this.discoveredItems = [...items];
      this.stateMachine.transition(StateEvent.ScanComplete);

      logger.info('Scan complete', {
        operationId: this.currentOperationId,
        context: { itemsFound: items.length },
      });

      return items;
    } catch (error) {
      this.stateMachine.transition(StateEvent.ScanFailed);
      logger.error('Scan failed', {
        operationId: this.currentOperationId,
        errorCode: error instanceof Error ? error.message : 'unknown',
      });
      throw error;
    }
  }

  /** Generate a preview of discovered items */
  getPreview(): Preview {
    if (!this.currentCategory) {
      throw new Error('No active scan');
    }
    return {
      category: this.currentCategory,
      totalItems: this.discoveredItems.length,
      items: [...this.discoveredItems],
      generatedAt: Date.now(),
    };
  }

  /** User selects items and moves to confirmation */
  selectItems(items: ReadonlyArray<CleanupItem>): void {
    this.selectedItems = [...items];
    this.stateMachine.transition(StateEvent.UserSelects);
    logger.info('Items selected for cleanup', {
      operationId: this.currentOperationId ?? undefined,
      context: { selectedCount: items.length },
    });
  }

  /** User confirms and starts execution */
  async startExecution(
    executeFn: (item: CleanupItem) => Promise<boolean>,
  ): Promise<void> {
    this.stateMachine.transition(StateEvent.UserConfirms);
    this.safetyController.reset();
    this.startedAt = Date.now();
    this.results = [];

    logger.info('Execution started', {
      operationId: this.currentOperationId ?? undefined,
      context: {
        itemCount: this.selectedItems.length,
        dryRun: this.dryRun,
      },
    });

    if (this.dryRun) {
      // Dry run: skip actual execution
      logger.info('Dry run mode: no destructive actions taken', {
        operationId: this.currentOperationId ?? undefined,
      });
      this.stateMachine.transition(StateEvent.BatchComplete);
      this.stateMachine.transition(StateEvent.AllDone);
      return;
    }

    const schedulerResult = await this.scheduler.processBatches(
      this.selectedItems,
      async (item) => {
        const safetyCheck = this.safetyController.canProceed();
        if (!safetyCheck.allowed) {
          return false;
        }
        const success = await executeFn(item);
        this.results.push({ itemId: item.id, success });
        return success;
      },
    );

    // Transition based on result
    if (schedulerResult.cancelled) {
      // State was already transitioned by the cancel/stop handler
      logger.info('Execution cancelled', {
        operationId: this.currentOperationId ?? undefined,
        context: {
          processed: schedulerResult.totalProcessed,
          succeeded: schedulerResult.totalSuccess,
          failed: schedulerResult.totalFailed,
        },
      });
    } else {
      this.stateMachine.transition(StateEvent.BatchComplete);
      this.stateMachine.transition(StateEvent.AllDone);
      logger.info('Execution complete', {
        operationId: this.currentOperationId ?? undefined,
        context: {
          processed: schedulerResult.totalProcessed,
          succeeded: schedulerResult.totalSuccess,
          failed: schedulerResult.totalFailed,
        },
      });
    }
  }

  /** Get current operation stats */
  getStats(): OperationStats | null {
    if (!this.currentOperationId || !this.currentCategory) return null;

    const successCount = this.results.filter((r) => r.success).length;
    const failedCount = this.results.filter((r) => !r.success).length;
    const totalBatches = Math.ceil(this.selectedItems.length / 5); // approximate

    return {
      operationId: this.currentOperationId,
      category: this.currentCategory,
      totalItems: this.selectedItems.length,
      processedItems: this.results.length,
      successCount,
      failedCount,
      skippedCount: 0,
      unknownCount: 0,
      currentBatch: Math.ceil(this.results.length / 5),
      totalBatches,
      startedAt: this.startedAt,
      elapsedMs: Date.now() - this.startedAt,
    };
  }

  /** Get the cleanup report */
  getReport(): CleanupReport | null {
    if (!this.currentOperationId || !this.currentCategory) return null;
    const stats = this.getStats();
    if (!stats) return null;

    return {
      operationId: this.currentOperationId,
      category: this.currentCategory,
      stats,
      results: [],
      verifications: [],
      startedAt: this.startedAt,
      completedAt: Date.now(),
      durationMs: Date.now() - this.startedAt,
      stoppedByUser: this.stateMachine.getState() === OperationState.UserAborted,
      stoppedBySafety: this.safetyController.getStats().securityChallengeDetected,
      dryRun: this.dryRun,
    };
  }

  /** User pauses the operation */
  pause(): void {
    this.safetyController.pause();
    if (this.stateMachine.canTransition(StateEvent.UserPauses)) {
      this.stateMachine.transition(StateEvent.UserPauses);
    }
    logger.info('Operation paused', { operationId: this.currentOperationId ?? undefined });
  }

  /** User resumes the operation */
  resume(): void {
    this.safetyController.resume();
    if (this.stateMachine.canTransition(StateEvent.UserResumes)) {
      this.stateMachine.transition(StateEvent.UserResumes);
    }
    logger.info('Operation resumed', { operationId: this.currentOperationId ?? undefined });
  }

  /** User stops the operation */
  stop(): void {
    this.safetyController.stop();
    this.scheduler.cancel();
    if (this.stateMachine.canTransition(StateEvent.UserStops)) {
      this.stateMachine.transition(StateEvent.UserStops);
    }
    logger.info('Operation stopped by user', { operationId: this.currentOperationId ?? undefined });
  }

  /** Cancel and return to idle */
  cancel(): void {
    this.scheduler.cancel();
    this.safetyController.stop();
    if (this.stateMachine.canTransition(StateEvent.UserCancels)) {
      this.stateMachine.transition(StateEvent.UserCancels);
    }
    logger.info('Operation cancelled', { operationId: this.currentOperationId ?? undefined });
  }

  /** Reset controller for new operation */
  reset(): void {
    this.currentOperationId = null;
    this.currentCategory = null;
    this.discoveredItems = [];
    this.selectedItems = [];
    this.results = [];
    this.startedAt = 0;
    this.dryRun = false;
    this.safetyController.reset();
  }
}
