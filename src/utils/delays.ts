/**
 * Utility functions for timing and delays.
 */

/** Wait for a given number of milliseconds */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait with jitter: actual delay is ms ± jitterFraction * ms */
export function delayWithJitter(ms: number, jitterFraction = 0.3): Promise<void> {
  const jitter = ms * jitterFraction * (Math.random() * 2 - 1);
  const actualDelay = Math.max(50, Math.round(ms + jitter));
  return delay(actualDelay);
}

/** Exponential backoff: baseMs * 2^attempt, capped at maxMs */
export function calculateBackoff(
  attempt: number,
  baseMs = 1000,
  maxMs = 30000,
): number {
  return Math.min(baseMs * Math.pow(2, attempt), maxMs);
}
