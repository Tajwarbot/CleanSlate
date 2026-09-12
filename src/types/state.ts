/**
 * State types for the CleanSlate operation state machine.
 *
 * Every transition is deterministic and testable.
 * The state machine enforces the destructive-action model:
 * DISCOVER → SCAN → PREVIEW → CONFIRM → EXECUTE → VERIFY → COMPLETE
 */

/** All possible states of the operation state machine */
export enum OperationState {
  /** No operation in progress */
  Idle = 'IDLE',
  /** Scanning for activity items */
  Scanning = 'SCANNING',
  /** Scan complete, preview ready for user */
  PreviewReady = 'PREVIEW_READY',
  /** Waiting for user to confirm destructive action */
  WaitingForConfirmation = 'WAITING_FOR_CONFIRMATION',
  /** Executing cleanup actions in batches */
  Executing = 'EXECUTING',
  /** Verifying batch results */
  Verifying = 'VERIFYING',
  /** All actions completed */
  Completed = 'COMPLETED',

  // Special states
  /** User has paused the operation */
  Paused = 'PAUSED',
  /** User has aborted the operation */
  UserAborted = 'USER_ABORTED',
  /** Facebook UI has unexpectedly changed */
  UIChanged = 'UI_CHANGED',
  /** Security challenge detected (CAPTCHA, checkpoint, etc.) */
  SecurityChallenge = 'SECURITY_CHALLENGE',
  /** Rate limit warning detected */
  RateLimited = 'RATE_LIMITED',
  /** Too many consecutive failures */
  ActionFailed = 'ACTION_FAILED',
  /** State cannot be determined */
  UnknownState = 'UNKNOWN_STATE',
}

/** Events that trigger state transitions */
export enum StateEvent {
  StartScan = 'START_SCAN',
  ScanComplete = 'SCAN_COMPLETE',
  ScanFailed = 'SCAN_FAILED',
  UserSelects = 'USER_SELECTS',
  UserConfirms = 'USER_CONFIRMS',
  UserCancels = 'USER_CANCELS',
  UserPauses = 'USER_PAUSES',
  UserResumes = 'USER_RESUMES',
  UserStops = 'USER_STOPS',
  UserAborts = 'USER_ABORTS',
  UserAcknowledges = 'USER_ACKNOWLEDGES',
  UserDismisses = 'USER_DISMISSES',
  BatchComplete = 'BATCH_COMPLETE',
  NextBatch = 'NEXT_BATCH',
  AllDone = 'ALL_DONE',
  ChallengeDetected = 'CHALLENGE_DETECTED',
  RateLimitDetected = 'RATE_LIMIT_DETECTED',
  MaxFailures = 'MAX_FAILURES',
  DomChanged = 'DOM_CHANGED',
  UnknownError = 'UNKNOWN_ERROR',
}

/** A single state transition definition */
export interface StateTransition {
  readonly from: OperationState;
  readonly event: StateEvent;
  readonly to: OperationState;
}

/** Listener for state changes */
export type StateChangeListener = (
  previousState: OperationState,
  newState: OperationState,
  event: StateEvent,
) => void;

/**
 * Complete transition table.
 * Only transitions listed here are permitted.
 * Any unlisted transition is rejected (fail-closed).
 */
export const STATE_TRANSITIONS: ReadonlyArray<StateTransition> = [
  // Normal flow
  { from: OperationState.Idle, event: StateEvent.StartScan, to: OperationState.Scanning },
  {
    from: OperationState.Scanning,
    event: StateEvent.ScanComplete,
    to: OperationState.PreviewReady,
  },
  { from: OperationState.Scanning, event: StateEvent.ScanFailed, to: OperationState.Idle },
  { from: OperationState.Scanning, event: StateEvent.UserStops, to: OperationState.Idle },
  {
    from: OperationState.PreviewReady,
    event: StateEvent.UserSelects,
    to: OperationState.WaitingForConfirmation,
  },
  { from: OperationState.PreviewReady, event: StateEvent.UserCancels, to: OperationState.Idle },
  {
    from: OperationState.WaitingForConfirmation,
    event: StateEvent.UserConfirms,
    to: OperationState.Executing,
  },
  {
    from: OperationState.WaitingForConfirmation,
    event: StateEvent.UserCancels,
    to: OperationState.Idle,
  },

  // Execution flow
  {
    from: OperationState.Executing,
    event: StateEvent.BatchComplete,
    to: OperationState.Verifying,
  },
  { from: OperationState.Executing, event: StateEvent.UserPauses, to: OperationState.Paused },
  { from: OperationState.Executing, event: StateEvent.UserStops, to: OperationState.Idle },
  {
    from: OperationState.Executing,
    event: StateEvent.ChallengeDetected,
    to: OperationState.SecurityChallenge,
  },
  {
    from: OperationState.Executing,
    event: StateEvent.RateLimitDetected,
    to: OperationState.RateLimited,
  },
  {
    from: OperationState.Executing,
    event: StateEvent.MaxFailures,
    to: OperationState.ActionFailed,
  },
  { from: OperationState.Executing, event: StateEvent.DomChanged, to: OperationState.UIChanged },
  {
    from: OperationState.Executing,
    event: StateEvent.UnknownError,
    to: OperationState.UnknownState,
  },

  // Verification flow
  { from: OperationState.Verifying, event: StateEvent.NextBatch, to: OperationState.Executing },
  { from: OperationState.Verifying, event: StateEvent.AllDone, to: OperationState.Completed },
  { from: OperationState.Verifying, event: StateEvent.UserStops, to: OperationState.Idle },

  // Pause flow
  { from: OperationState.Paused, event: StateEvent.UserResumes, to: OperationState.Executing },
  { from: OperationState.Paused, event: StateEvent.UserAborts, to: OperationState.Idle },

  // Error acknowledgement flow
  {
    from: OperationState.SecurityChallenge,
    event: StateEvent.UserAcknowledges,
    to: OperationState.Idle,
  },
  {
    from: OperationState.RateLimited,
    event: StateEvent.UserAcknowledges,
    to: OperationState.Idle,
  },
  {
    from: OperationState.ActionFailed,
    event: StateEvent.UserAcknowledges,
    to: OperationState.Idle,
  },
  {
    from: OperationState.UIChanged,
    event: StateEvent.UserAcknowledges,
    to: OperationState.Idle,
  },
  {
    from: OperationState.UnknownState,
    event: StateEvent.UserAcknowledges,
    to: OperationState.Idle,
  },

  // Completion
  { from: OperationState.Completed, event: StateEvent.UserDismisses, to: OperationState.Idle },
];

/** States that indicate an error or safety stop */
export const ERROR_STATES: ReadonlySet<OperationState> = new Set([
  OperationState.SecurityChallenge,
  OperationState.RateLimited,
  OperationState.ActionFailed,
  OperationState.UIChanged,
  OperationState.UnknownState,
]);

/** States where destructive actions may be in progress */
export const ACTIVE_STATES: ReadonlySet<OperationState> = new Set([
  OperationState.Executing,
  OperationState.Verifying,
]);

/** States where no operation is running */
export const TERMINAL_STATES: ReadonlySet<OperationState> = new Set([
  OperationState.Idle,
  OperationState.Completed,
  OperationState.UserAborted,
]);
