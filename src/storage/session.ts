/**
 * CleanSlate Session Storage
 *
 * Manages interrupted operation session state for recovery.
 * Never automatically resumes — requires explicit user action.
 */

import type { ActivityCategory, OperationId, Timestamp } from '../types/common';
import type { OperationState } from '../types/state';
import { logger } from '../core/logging/logger';

const SESSION_KEY = 'cleanslate_session';

/** Serializable session state */
export interface OperationSession {
  readonly operationId: OperationId;
  readonly category: ActivityCategory;
  readonly state: OperationState;
  readonly totalItems: number;
  readonly processedItems: number;
  readonly successCount: number;
  readonly failedCount: number;
  readonly startedAt: Timestamp;
  readonly interruptedAt: Timestamp;
  readonly dryRun: boolean;
}

/** Save current session state (for recovery after interruption) */
export async function saveSession(session: OperationSession): Promise<void> {
  try {
    await chrome.storage.local.set({ [SESSION_KEY]: session });
    logger.debug('Session saved', {
      operationId: session.operationId,
    });
  } catch (error) {
    logger.error('Failed to save session', {
      errorCode: 'STORAGE_WRITE_FAILED',
      context: { error: error instanceof Error ? error.message : 'unknown' },
    });
  }
}

/** Load an interrupted session (if any) */
export async function loadSession(): Promise<OperationSession | null> {
  try {
    const result = await chrome.storage.local.get(SESSION_KEY);
    const session = result[SESSION_KEY] as OperationSession | undefined;

    if (!session || typeof session !== 'object') {
      return null;
    }

    // Validate required fields
    if (
      typeof session.operationId !== 'string' ||
      typeof session.category !== 'string' ||
      typeof session.state !== 'string'
    ) {
      logger.warn('Invalid session data found, discarding');
      await discardSession();
      return null;
    }

    logger.info('Interrupted session found', {
      operationId: session.operationId,
      context: {
        category: session.category,
        processedItems: session.processedItems,
        totalItems: session.totalItems,
      },
    });

    return session;
  } catch (error) {
    logger.error('Failed to load session', {
      errorCode: 'STORAGE_READ_FAILED',
      context: { error: error instanceof Error ? error.message : 'unknown' },
    });
    return null;
  }
}

/** Discard an interrupted session */
export async function discardSession(): Promise<void> {
  try {
    await chrome.storage.local.remove(SESSION_KEY);
    logger.info('Session discarded');
  } catch (error) {
    logger.error('Failed to discard session', {
      errorCode: 'STORAGE_WRITE_FAILED',
      context: { error: error instanceof Error ? error.message : 'unknown' },
    });
  }
}
