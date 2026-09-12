/**
 * CleanSlate Error Hierarchy
 *
 * Typed errors for deterministic error handling.
 * Every error includes a code, message, and recoverability flag.
 */

/** Error codes used throughout the extension */
export enum ErrorCode {
  // State errors
  InvalidTransition = 'INVALID_TRANSITION',
  InvalidState = 'INVALID_STATE',
  StateCorruption = 'STATE_CORRUPTION',

  // Safety errors
  SafetyStop = 'SAFETY_STOP',
  SecurityChallenge = 'SECURITY_CHALLENGE',
  RateLimited = 'RATE_LIMITED',
  MaxFailuresReached = 'MAX_FAILURES_REACHED',
  EmergencyStop = 'EMERGENCY_STOP',

  // DOM errors
  ElementNotFound = 'ELEMENT_NOT_FOUND',
  DomChanged = 'DOM_CHANGED',
  SelectorFailed = 'SELECTOR_FAILED',
  VerificationFailed = 'VERIFICATION_FAILED',
  UnexpectedModal = 'UNEXPECTED_MODAL',
  NavigationDetected = 'NAVIGATION_DETECTED',

  // Operation errors
  OperationFailed = 'OPERATION_FAILED',
  OperationTimeout = 'OPERATION_TIMEOUT',
  OperationCancelled = 'OPERATION_CANCELLED',
  ValidationFailed = 'VALIDATION_FAILED',

  // Messaging errors
  InvalidMessage = 'INVALID_MESSAGE',
  MessageTimeout = 'MESSAGE_TIMEOUT',
  UnknownMessageType = 'UNKNOWN_MESSAGE_TYPE',

  // Storage errors
  StorageReadFailed = 'STORAGE_READ_FAILED',
  StorageWriteFailed = 'STORAGE_WRITE_FAILED',
  StorageCorrupted = 'STORAGE_CORRUPTED',

  // Capability errors
  CapabilityUnavailable = 'CAPABILITY_UNAVAILABLE',
  UIChanged = 'UI_CHANGED',
  UnsafeToAutomate = 'UNSAFE_TO_AUTOMATE',

  // Generic
  Unknown = 'UNKNOWN',
}

/** Base error class for all CleanSlate errors */
export class CleanSlateError extends Error {
  readonly code: ErrorCode;
  readonly recoverable: boolean;
  readonly timestamp: number;

  constructor(code: ErrorCode, message: string, recoverable = false) {
    super(message);
    this.name = 'CleanSlateError';
    this.code = code;
    this.recoverable = recoverable;
    this.timestamp = Date.now();
  }

  /** Convert to a serializable object (no sensitive data) */
  toInfo(): { code: string; message: string; recoverable: boolean; timestamp: number } {
    return {
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
    };
  }
}

/** Error when a state transition is not allowed */
export class InvalidTransitionError extends CleanSlateError {
  constructor(from: string, event: string) {
    super(
      ErrorCode.InvalidTransition,
      `Invalid transition: cannot process event '${event}' in state '${from}'`,
      false,
    );
    this.name = 'InvalidTransitionError';
  }
}

/** Error when the safety controller stops an operation */
export class SafetyStopError extends CleanSlateError {
  readonly reason: string;

  constructor(reason: string) {
    super(ErrorCode.SafetyStop, `Safety stop: ${reason}`, false);
    this.name = 'SafetyStopError';
    this.reason = reason;
  }
}

/** Error when a security challenge is detected */
export class SecurityChallengeError extends CleanSlateError {
  constructor(description: string) {
    super(
      ErrorCode.SecurityChallenge,
      `Security challenge detected: ${description}. Operation stopped to protect your account.`,
      false,
    );
    this.name = 'SecurityChallengeError';
  }
}

/** Error when DOM changes unexpectedly */
export class DomChangedError extends CleanSlateError {
  constructor(details: string) {
    super(ErrorCode.DomChanged, `DOM changed unexpectedly: ${details}`, false);
    this.name = 'DomChangedError';
  }
}

/** Error when a required element cannot be found */
export class ElementNotFoundError extends CleanSlateError {
  constructor(description: string) {
    super(ErrorCode.ElementNotFound, `Element not found: ${description}`, true);
    this.name = 'ElementNotFoundError';
  }
}

/** Error when verification of an action fails */
export class VerificationFailedError extends CleanSlateError {
  constructor(itemId: string) {
    super(
      ErrorCode.VerificationFailed,
      `Verification failed for item ${itemId}: action result is UNKNOWN, not SUCCESS`,
      true,
    );
    this.name = 'VerificationFailedError';
  }
}

/** Error when rate limiting is detected */
export class RateLimitedError extends CleanSlateError {
  constructor() {
    super(
      ErrorCode.RateLimited,
      'Rate limit detected. Operation stopped to protect your account.',
      false,
    );
    this.name = 'RateLimitedError';
  }
}

/** Error for invalid messages */
export class InvalidMessageError extends CleanSlateError {
  constructor(details: string) {
    super(ErrorCode.InvalidMessage, `Invalid message: ${details}`, false);
    this.name = 'InvalidMessageError';
  }
}

/** Error for storage operations */
export class StorageError extends CleanSlateError {
  constructor(code: ErrorCode, details: string) {
    super(code, `Storage error: ${details}`, true);
    this.name = 'StorageError';
  }
}
