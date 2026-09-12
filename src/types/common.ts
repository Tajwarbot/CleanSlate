/**
 * Common shared types used across the CleanSlate extension.
 */

/** Unique identifier for operations and items */
export type OperationId = string;
export type ItemId = string;

/** Timestamp in milliseconds since epoch */
export type Timestamp = number;

/** Supported platforms */
export enum Platform {
  Facebook = 'facebook',
  Messenger = 'messenger',
}

/** Activity categories for Facebook */
export enum FacebookCategory {
  LikesReactions = 'likes_reactions',
  Comments = 'comments',
  PageLikes = 'page_likes',
  Follows = 'follows',
  Other = 'other',
}

/** Activity categories for Messenger */
export enum MessengerCategory {
  Conversations = 'conversations',
}

/** All activity categories */
export type ActivityCategory = FacebookCategory | MessengerCategory;

/** Capability status for a given category */
export enum CapabilityStatus {
  Supported = 'supported',
  PartiallySupported = 'partially_supported',
  Unavailable = 'unavailable',
  UIChanged = 'ui_changed',
  UnsafeToAutomate = 'unsafe_to_automate',
}

/** Capability detection result */
export interface Capability {
  readonly category: ActivityCategory;
  readonly status: CapabilityStatus;
  readonly reason?: string;
  readonly detectedAt: Timestamp;
}

/** Result of a single action */
export enum ActionStatus {
  Success = 'success',
  Failed = 'failed',
  Skipped = 'skipped',
  Unknown = 'unknown',
}

/** Generic result wrapper */
export interface Result<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: CleanSlateErrorInfo;
}

/** Serializable error info */
export interface CleanSlateErrorInfo {
  readonly code: string;
  readonly message: string;
  readonly recoverable: boolean;
  readonly timestamp: Timestamp;
}

/** Settings schema */
export interface CleanSlateSettings {
  readonly version: number;
  readonly dryRunDefault: boolean;
  readonly batchSize: number;
  readonly cooldownMs: number;
  readonly maxActionsPerRun: number;
  readonly maxConsecutiveFailures: number;
  readonly confirmationRequired: boolean;
  readonly enabledCategories: ReadonlyArray<ActivityCategory>;
  readonly theme: 'system' | 'light' | 'dark';
}

/** Default settings */
export const DEFAULT_SETTINGS: CleanSlateSettings = {
  version: 1,
  dryRunDefault: true,
  batchSize: 5,
  cooldownMs: 3000,
  maxActionsPerRun: 500,
  maxConsecutiveFailures: 5,
  confirmationRequired: true,
  enabledCategories: [
    FacebookCategory.LikesReactions,
    FacebookCategory.Comments,
    FacebookCategory.PageLikes,
    FacebookCategory.Follows,
  ],
  theme: 'system',
};
