interface ScanProgressPageProps {
  phase: string;
  detail: string;
  loadedItems: number;
  onStopLoading: () => void;
  onContinueLoading: () => void;
}

export function ScanProgressPage({
  phase,
  detail,
  loadedItems,
  onStopLoading,
  onContinueLoading,
}: ScanProgressPageProps) {
  return (
    <div className="cs-page cs-animate-fade-in">
      <div className="cs-activity__title">Loading activity</div>
      <div className="cs-card" style={{ padding: 'var(--cs-space-md)', marginBottom: 'var(--cs-space-md)' }}>
        <div style={{ fontWeight: 700, marginBottom: 'var(--cs-space-sm)' }}>{phase}</div>
        <div style={{ color: 'var(--cs-text-secondary)', marginBottom: 'var(--cs-space-md)' }}>{detail}</div>
        <div
          role="progressbar"
          aria-label="Activity loading progress"
          style={{
            height: 8,
            background: 'var(--cs-bg-tertiary)',
            border: '1px solid var(--cs-border-default)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--cs-primary-500)',
              animation: 'cs-progress-indeterminate 1.2s linear infinite',
            }}
          />
        </div>
        <div style={{ marginTop: 'var(--cs-space-md)', color: 'var(--cs-text-tertiary)' }}>
          {loadedItems} items discovered so far
        </div>
      </div>
      <div className="cs-scan-progress__actions">
        <button
          type="button"
          className="cs-btn cs-btn--danger cs-btn--full"
          onClick={onStopLoading}
        >
          Stop here and review this batch
        </button>
        <button
          type="button"
          className="cs-btn cs-btn--ghost cs-btn--full"
          onClick={onContinueLoading}
        >
          Continue loading to the end
        </button>
      </div>
      <div className="cs-settings__label-desc">
        Stopping keeps the activity currently rendered in Facebook. Cleanup then uses Facebook's
        native All and Remove controls for that batch.
      </div>
    </div>
  );
}
