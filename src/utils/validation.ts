/**
 * Message validation utilities.
 *
 * Treats all incoming data as untrusted.
 * Webpage content can NEVER issue extension commands.
 */

import { type ExtensionMessage, MessageSource, MessageType, isValidMessage } from '../types/messages';

/**
 * Validate and sanitize an incoming message.
 * Returns the validated message or null if invalid.
 */
export function validateIncomingMessage(data: unknown): ExtensionMessage | null {
  if (!isValidMessage(data)) {
    return null;
  }
  return data;
}

/**
 * Check if a message source is allowed to send a given message type.
 * Enforces that content scripts cannot issue operation commands.
 */
export function isAuthorizedMessage(message: ExtensionMessage): boolean {
  const { type, source } = message;

  // Content scripts can only send scan results, capabilities, and safety alerts
  if (source === MessageSource.ContentScript) {
    const allowedTypes: MessageType[] = [
      MessageType.ScanResult,
      MessageType.ScanError,
      MessageType.CapabilitiesResult,
      MessageType.SecurityChallenge,
      MessageType.SafetyStop,
      MessageType.OperationProgress,
      MessageType.OperationError,
      MessageType.OperationComplete,
    ];
    return allowedTypes.includes(type);
  }

  // Popup can send user-initiated commands
  if (source === MessageSource.Popup) {
    const allowedTypes: MessageType[] = [
      MessageType.StartScan,
      MessageType.DetectCapabilities,
      MessageType.RequestConfirmation,
      MessageType.StartOperation,
      MessageType.PauseOperation,
      MessageType.ResumeOperation,
      MessageType.StopOperation,
      MessageType.GetState,
      MessageType.GetSettings,
      MessageType.UpdateSettings,
      MessageType.GetInterruptedSession,
      MessageType.DiscardSession,
    ];
    return allowedTypes.includes(type);
  }

  // Service worker can send anything
  if (source === MessageSource.ServiceWorker) {
    return true;
  }

  return false;
}
