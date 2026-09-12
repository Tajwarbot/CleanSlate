/**
 * Typed extension messaging schema.
 *
 * All messages between popup, service worker, and content scripts
 * use discriminated unions for type safety.
 *
 * Security: Every incoming message is validated. Webpage content
 * can NEVER issue extension commands. DOM content is untrusted input.
 */

import type {
  ActivityCategory,
  Capability,
  CleanSlateErrorInfo,
  OperationId,
} from './common';
import type {
  ActionResult,
  CleanupItem,
  CleanupReport,
  OperationStats,
  Preview,
} from './operations';
import type { OperationState } from './state';

/** All possible message types */
export enum MessageType {
  // Scan
  StartScan = 'START_SCAN',
  ScanResult = 'SCAN_RESULT',
  ScanError = 'SCAN_ERROR',

  // Operation lifecycle
  RequestConfirmation = 'REQUEST_CONFIRMATION',
  StartOperation = 'START_OPERATION',
  PauseOperation = 'PAUSE_OPERATION',
  ResumeOperation = 'RESUME_OPERATION',
  StopOperation = 'STOP_OPERATION',

  // Progress and results
  OperationProgress = 'OPERATION_PROGRESS',
  OperationError = 'OPERATION_ERROR',
  OperationComplete = 'OPERATION_COMPLETE',

  // State
  GetState = 'GET_STATE',
  StateUpdate = 'STATE_UPDATE',

  // Capabilities
  DetectCapabilities = 'DETECT_CAPABILITIES',
  CapabilitiesResult = 'CAPABILITIES_RESULT',

  // Safety
  SecurityChallenge = 'SECURITY_CHALLENGE',
  SafetyStop = 'SAFETY_STOP',

  // Settings
  GetSettings = 'GET_SETTINGS',
  UpdateSettings = 'UPDATE_SETTINGS',
  SettingsResult = 'SETTINGS_RESULT',

  // Recovery
  GetInterruptedSession = 'GET_INTERRUPTED_SESSION',
  DiscardSession = 'DISCARD_SESSION',
}

/** Source identifier for message validation */
export enum MessageSource {
  Popup = 'popup',
  ServiceWorker = 'service_worker',
  ContentScript = 'content_script',
}

/** Base message shape */
interface BaseMessage {
  readonly type: MessageType;
  readonly source: MessageSource;
  readonly timestamp: number;
  readonly id: string;
}

// --- Scan Messages ---

export interface StartScanMessage extends BaseMessage {
  readonly type: MessageType.StartScan;
  readonly category: ActivityCategory;
  readonly dryRun: boolean;
}

export interface ScanResultMessage extends BaseMessage {
  readonly type: MessageType.ScanResult;
  readonly category: ActivityCategory;
  readonly items: ReadonlyArray<CleanupItem>;
  readonly preview: Preview;
}

export interface ScanErrorMessage extends BaseMessage {
  readonly type: MessageType.ScanError;
  readonly error: CleanSlateErrorInfo;
}

// --- Operation Lifecycle Messages ---

export interface RequestConfirmationMessage extends BaseMessage {
  readonly type: MessageType.RequestConfirmation;
  readonly preview: Preview;
  readonly selectedItems: ReadonlyArray<CleanupItem>;
}

export interface StartOperationMessage extends BaseMessage {
  readonly type: MessageType.StartOperation;
  readonly operationId: OperationId;
  readonly category: ActivityCategory;
  readonly items: ReadonlyArray<CleanupItem>;
  readonly dryRun: boolean;
}

export interface PauseOperationMessage extends BaseMessage {
  readonly type: MessageType.PauseOperation;
  readonly operationId: OperationId;
}

export interface ResumeOperationMessage extends BaseMessage {
  readonly type: MessageType.ResumeOperation;
  readonly operationId: OperationId;
}

export interface StopOperationMessage extends BaseMessage {
  readonly type: MessageType.StopOperation;
  readonly operationId: OperationId;
}

// --- Progress Messages ---

export interface OperationProgressMessage extends BaseMessage {
  readonly type: MessageType.OperationProgress;
  readonly stats: OperationStats;
  readonly lastResult?: ActionResult;
}

export interface OperationErrorMessage extends BaseMessage {
  readonly type: MessageType.OperationError;
  readonly operationId: OperationId;
  readonly error: CleanSlateErrorInfo;
}

export interface OperationCompleteMessage extends BaseMessage {
  readonly type: MessageType.OperationComplete;
  readonly report: CleanupReport;
}

// --- State Messages ---

export interface GetStateMessage extends BaseMessage {
  readonly type: MessageType.GetState;
}

export interface StateUpdateMessage extends BaseMessage {
  readonly type: MessageType.StateUpdate;
  readonly state: OperationState;
  readonly stats?: OperationStats;
}

// --- Capability Messages ---

export interface DetectCapabilitiesMessage extends BaseMessage {
  readonly type: MessageType.DetectCapabilities;
}

export interface CapabilitiesResultMessage extends BaseMessage {
  readonly type: MessageType.CapabilitiesResult;
  readonly capabilities: ReadonlyArray<Capability>;
}

// --- Safety Messages ---

export interface SecurityChallengeMessage extends BaseMessage {
  readonly type: MessageType.SecurityChallenge;
  readonly description: string;
}

export interface SafetyStopMessage extends BaseMessage {
  readonly type: MessageType.SafetyStop;
  readonly reason: string;
}

// --- Settings Messages ---

export interface GetSettingsMessage extends BaseMessage {
  readonly type: MessageType.GetSettings;
}

export interface UpdateSettingsMessage extends BaseMessage {
  readonly type: MessageType.UpdateSettings;
  readonly settings: Record<string, unknown>;
}

export interface SettingsResultMessage extends BaseMessage {
  readonly type: MessageType.SettingsResult;
  readonly settings: Record<string, unknown>;
}

// --- Recovery Messages ---

export interface GetInterruptedSessionMessage extends BaseMessage {
  readonly type: MessageType.GetInterruptedSession;
}

export interface DiscardSessionMessage extends BaseMessage {
  readonly type: MessageType.DiscardSession;
}

/** Discriminated union of all messages */
export type ExtensionMessage =
  | StartScanMessage
  | ScanResultMessage
  | ScanErrorMessage
  | RequestConfirmationMessage
  | StartOperationMessage
  | PauseOperationMessage
  | ResumeOperationMessage
  | StopOperationMessage
  | OperationProgressMessage
  | OperationErrorMessage
  | OperationCompleteMessage
  | GetStateMessage
  | StateUpdateMessage
  | DetectCapabilitiesMessage
  | CapabilitiesResultMessage
  | SecurityChallengeMessage
  | SafetyStopMessage
  | GetSettingsMessage
  | UpdateSettingsMessage
  | SettingsResultMessage
  | GetInterruptedSessionMessage
  | DiscardSessionMessage;

/**
 * Validate that an unknown value is a valid ExtensionMessage.
 * Treats all incoming data as untrusted.
 */
export function isValidMessage(data: unknown): data is ExtensionMessage {
  if (data === null || data === undefined || typeof data !== 'object') {
    return false;
  }

  const msg = data as Record<string, unknown>;

  // Must have required base fields
  if (typeof msg['type'] !== 'string') return false;
  if (typeof msg['source'] !== 'string') return false;
  if (typeof msg['timestamp'] !== 'number') return false;
  if (typeof msg['id'] !== 'string') return false;

  // Type must be a known MessageType
  const knownTypes = Object.values(MessageType) as string[];
  if (!knownTypes.includes(msg['type'] as string)) return false;

  // Source must be a known MessageSource
  const knownSources = Object.values(MessageSource) as string[];
  if (!knownSources.includes(msg['source'] as string)) return false;

  return true;
}

/** Generate a unique message ID */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Create a base message with common fields */
export function createBaseMessage(
  type: MessageType,
  source: MessageSource,
): Pick<BaseMessage, 'type' | 'source' | 'timestamp' | 'id'> {
  return {
    type,
    source,
    timestamp: Date.now(),
    id: generateMessageId(),
  };
}
