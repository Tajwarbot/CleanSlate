interface ScanProgressPageProps {
  phase: string;
  detail: string;
  loadedItems: number;
}

export function ScanProgressPage({ phase, detail, loadedItems }: ScanProgressPageProps) {
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
      <div className="cs-settings__label-desc">
        Keep the Facebook tab open. You can close and reopen this popup; loading continues in the tab.
      </div>
    </div>
  );
}
