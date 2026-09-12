/**
 * CleanSlate Settings Storage
 *
 * Reads and writes user settings to chrome.storage.local.
 * Validates settings on read. Never stores sensitive data.
 */

import type { CleanSlateSettings } from '../types/common';
import { DEFAULT_SETTINGS } from '../types/common';
import { logger } from '../core/logging/logger';

const SETTINGS_KEY = 'cleanslate_settings';

/**
 * Validate settings object and fill in defaults for missing fields.
 */
function validateSettings(raw: unknown): CleanSlateSettings {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const obj = raw as Record<string, unknown>;

  return {
    version: typeof obj['version'] === 'number' ? obj['version'] : DEFAULT_SETTINGS.version,
    dryRunDefault:
      typeof obj['dryRunDefault'] === 'boolean'
        ? obj['dryRunDefault']
        : DEFAULT_SETTINGS.dryRunDefault,
    batchSize:
      typeof obj['batchSize'] === 'number' && obj['batchSize'] >= 1 && obj['batchSize'] <= 20
        ? obj['batchSize']
        : DEFAULT_SETTINGS.batchSize,
    cooldownMs:
      typeof obj['cooldownMs'] === 'number' &&
      obj['cooldownMs'] >= 1000 &&
      obj['cooldownMs'] <= 30000
        ? obj['cooldownMs']
        : DEFAULT_SETTINGS.cooldownMs,
    maxActionsPerRun:
      typeof obj['maxActionsPerRun'] === 'number' &&
      obj['maxActionsPerRun'] >= 10 &&
      obj['maxActionsPerRun'] <= 5000
        ? obj['maxActionsPerRun']
        : DEFAULT_SETTINGS.maxActionsPerRun,
    maxConsecutiveFailures:
      typeof obj['maxConsecutiveFailures'] === 'number' &&
      obj['maxConsecutiveFailures'] >= 1 &&
      obj['maxConsecutiveFailures'] <= 20
        ? obj['maxConsecutiveFailures']
        : DEFAULT_SETTINGS.maxConsecutiveFailures,
    confirmationRequired:
      typeof obj['confirmationRequired'] === 'boolean'
        ? obj['confirmationRequired']
        : DEFAULT_SETTINGS.confirmationRequired,
    enabledCategories: Array.isArray(obj['enabledCategories'])
      ? (obj['enabledCategories'] as CleanSlateSettings['enabledCategories'])
      : DEFAULT_SETTINGS.enabledCategories,
    theme:
      obj['theme'] === 'system' || obj['theme'] === 'light' || obj['theme'] === 'dark'
        ? obj['theme']
        : DEFAULT_SETTINGS.theme,
  };
}

/** Read settings from chrome.storage.local */
export async function loadSettings(): Promise<CleanSlateSettings> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = validateSettings(result[SETTINGS_KEY]);
    logger.debug('Settings loaded');
    return settings;
  } catch (error) {
    logger.error('Failed to load settings', {
      errorCode: 'STORAGE_READ_FAILED',
      context: { error: error instanceof Error ? error.message : 'unknown' },
    });
    return { ...DEFAULT_SETTINGS };
  }
}

/** Save settings to chrome.storage.local */
export async function saveSettings(
  settings: Partial<CleanSlateSettings>,
): Promise<CleanSlateSettings> {
  try {
    const current = await loadSettings();
    const merged = validateSettings({ ...current, ...settings });
    await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
    logger.info('Settings saved');
    return merged;
  } catch (error) {
    logger.error('Failed to save settings', {
      errorCode: 'STORAGE_WRITE_FAILED',
      context: { error: error instanceof Error ? error.message : 'unknown' },
    });
    throw error;
  }
}

/** Reset settings to defaults */
export async function resetSettings(): Promise<CleanSlateSettings> {
  return saveSettings(DEFAULT_SETTINGS);
}
