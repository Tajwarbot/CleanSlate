/**
 * ConfirmPage — final confirmation before executing destructive actions.
 */

import { WarningBox } from '../components/WarningBox';

interface ConfirmPageProps {
  selectedCount: number;
  category: string;
  dryRun: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmPage({
  selectedCount,
  category,
  dryRun,
  onConfirm,
  onCancel,
}: ConfirmPageProps) {
  const categoryLabel = category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="cs-page cs-animate-fade-in">
      <div className="cs-confirm__title">Confirm Cleanup</div>

      <div className="cs-confirm__summary">
        <div className="cs-confirm__about-to">You're about to remove:</div>
        <div className="cs-confirm__count">
          {selectedCount} {categoryLabel}
        </div>
      </div>

      {dryRun && (
        <div
          className="cs-card"
          style={{
            textAlign: 'center',
            marginBottom: 'var(--cs-space-lg)',
            color: 'var(--cs-primary-400)',
            fontWeight: 600,
          }}
        >
          🔒 Dry Run — no changes will be made
        </div>
      )}

      <WarningBox icon="⚠️">
        Some actions may not be reversible.
      </WarningBox>

      <div style={{ height: 'var(--cs-space-sm)' }} />

      <WarningBox icon="ℹ️">
        CleanSlate will process them in small batches and stop if unexpected behavior is
        detected.
      </WarningBox>

      <div className="cs-confirm__actions">
        <button
          id="confirm-start-btn"
          className={`cs-btn cs-btn--full cs-btn--lg ${dryRun ? 'cs-btn--primary' : 'cs-btn--danger'}`}
          onClick={onConfirm}
          type="button"
        >
          {dryRun ? 'Start Dry Run' : 'I Understand — Start Cleanup'}
        </button>
        <button
          id="confirm-cancel-btn"
          className="cs-btn cs-btn--ghost cs-btn--full"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
