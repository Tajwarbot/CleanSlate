/**
 * SettingsPage — user preferences for cleanup behavior.
 */

import { useState, useEffect } from 'react';
import type { CleanSlateSettings } from '../../../types/common';
import { DEFAULT_SETTINGS } from '../../../types/common';

interface SettingsPageProps {
  settings: CleanSlateSettings;
  onSave: (settings: Partial<CleanSlateSettings>) => void;
  onReset: () => void;
  onBack: () => void;
}

export function SettingsPage({ settings, onSave, onReset, onBack }: SettingsPageProps) {
  const [local, setLocal] = useState<CleanSlateSettings>(settings);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocal(settings);
    setDirty(false);
  }, [settings]);

  function update<K extends keyof CleanSlateSettings>(key: K, value: CleanSlateSettings[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function handleSave() {
    onSave(local);
    setDirty(false);
  }

  return (
    <div className="cs-page cs-animate-fade-in">
      <div className="cs-settings__title">Settings</div>

      {/* Safety */}
      <div className="cs-settings__group">
        <div className="cs-settings__group-title">Safety</div>

        <div className="cs-settings__row">
          <div className="cs-settings__label">
            <span className="cs-settings__label-text">Dry Run by Default</span>
            <span className="cs-settings__label-desc">
              Scan and preview without making changes
            </span>
          </div>
          <label className="cs-toggle" htmlFor="setting-dryrun">
            <input
              id="setting-dryrun"
              type="checkbox"
              className="cs-toggle__input"
              checked={local.dryRunDefault}
              onChange={(e) => update('dryRunDefault', e.target.checked)}
            />
          </label>
        </div>

        <div className="cs-settings__row">
          <div className="cs-settings__label">
            <span className="cs-settings__label-text">Require Confirmation</span>
            <span className="cs-settings__label-desc">
              Confirm before starting destructive actions
            </span>
          </div>
          <label className="cs-toggle" htmlFor="setting-confirm">
            <input
              id="setting-confirm"
              type="checkbox"
              className="cs-toggle__input"
              checked={local.confirmationRequired}
              onChange={(e) => update('confirmationRequired', e.target.checked)}
            />
          </label>
        </div>
      </div>

      {/* Performance */}
      <div className="cs-settings__group">
        <div className="cs-settings__group-title">Performance</div>

        <div className="cs-settings__row">
          <div className="cs-settings__label">
            <span className="cs-settings__label-text">Batch Size</span>
            <span className="cs-settings__label-desc">Items per batch (1–20)</span>
          </div>
          <input
            id="setting-batch-size"
            type="number"
            className="cs-settings__input"
            min={1}
            max={20}
            value={local.batchSize}
            onChange={(e) =>
              update('batchSize', Math.max(1, Math.min(20, Number(e.target.value) || DEFAULT_SETTINGS.batchSize)))
            }
          />
        </div>

        <div className="cs-settings__row">
          <div className="cs-settings__label">
            <span className="cs-settings__label-text">Cooldown (ms)</span>
            <span className="cs-settings__label-desc">Delay between batches (1000–30000)</span>
          </div>
          <input
            id="setting-cooldown"
            type="number"
            className="cs-settings__input"
            min={1000}
            max={30000}
            step={500}
            value={local.cooldownMs}
            onChange={(e) =>
              update('cooldownMs', Math.max(1000, Math.min(30000, Number(e.target.value) || DEFAULT_SETTINGS.cooldownMs)))
            }
          />
        </div>

        <div className="cs-settings__row">
          <div className="cs-settings__label">
            <span className="cs-settings__label-text">Max Actions per Run</span>
            <span className="cs-settings__label-desc">Safety cap (10–5000)</span>
          </div>
          <input
            id="setting-max-actions"
            type="number"
            className="cs-settings__input"
            min={10}
            max={5000}
            step={10}
            value={local.maxActionsPerRun}
            onChange={(e) =>
              update(
                'maxActionsPerRun',
                Math.max(10, Math.min(5000, Number(e.target.value) || DEFAULT_SETTINGS.maxActionsPerRun)),
              )
            }
          />
        </div>

        <div className="cs-settings__row">
          <div className="cs-settings__label">
            <span className="cs-settings__label-text">Max Consecutive Failures</span>
            <span className="cs-settings__label-desc">Stop after this many failures (1–20)</span>
          </div>
          <input
            id="setting-max-failures"
            type="number"
            className="cs-settings__input"
            min={1}
            max={20}
            value={local.maxConsecutiveFailures}
            onChange={(e) =>
              update(
                'maxConsecutiveFailures',
                Math.max(1, Math.min(20, Number(e.target.value) || DEFAULT_SETTINGS.maxConsecutiveFailures)),
              )
            }
          />
        </div>
      </div>

      {/* Appearance */}
      <div className="cs-settings__group">
        <div className="cs-settings__group-title">Appearance</div>

        <div className="cs-settings__row">
          <div className="cs-settings__label">
            <span className="cs-settings__label-text">Theme</span>
          </div>
          <select
            id="setting-theme"
            className="cs-settings__input"
            style={{ width: '100px' }}
            value={local.theme}
            onChange={(e) => update('theme', e.target.value as 'system' | 'light' | 'dark')}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cs-space-sm)', marginTop: 'var(--cs-space-lg)' }}>
        <button
          id="settings-save-btn"
          className="cs-btn cs-btn--primary cs-btn--full"
          disabled={!dirty}
          onClick={handleSave}
          type="button"
        >
          Save Settings
        </button>
        <div style={{ display: 'flex', gap: 'var(--cs-space-sm)' }}>
          <button
            id="settings-reset-btn"
            className="cs-btn cs-btn--ghost"
            onClick={onReset}
            type="button"
            style={{ flex: 1 }}
          >
            Reset to Defaults
          </button>
          <button
            id="settings-back-btn"
            className="cs-btn cs-btn--ghost"
            onClick={onBack}
            type="button"
            style={{ flex: 1 }}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
