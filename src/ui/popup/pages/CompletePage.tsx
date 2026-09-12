/**
 * CompletePage — success screen after cleanup finishes.
 */

import { StatsGrid } from '../components/StatsGrid';
import type { OperationStats } from '../../../types/operations';

interface CompletePageProps {
  stats: OperationStats | null;
  dryRun: boolean;
  stoppedByUser: boolean;
  onStartAnother: () => void;
}

export function CompletePage({
  stats,
  dryRun,
  stoppedByUser,
  onStartAnother,
}: CompletePageProps) {
  const total = stats?.processedItems ?? 0;
  const success = stats?.successCount ?? 0;
  const failed = stats?.failedCount ?? 0;
  const skipped = stats?.skippedCount ?? 0;
  const elapsed = stats?.elapsedMs ?? 0;
  const elapsedStr = elapsed > 0 ? `${Math.round(elapsed / 1000)}s` : '—';

  const gridStats = [
    { label: 'Processed', value: total },
    { label: 'Successful', value: success, variant: 'success' as const },
    { label: 'Skipped', value: skipped, variant: 'warning' as const },
    {
      label: 'Failed',
      value: failed,
      variant: failed > 0 ? ('danger' as const) : undefined,
    },
  ];

  const title = dryRun
    ? 'Dry Run Complete'
    : stoppedByUser
      ? 'Cleanup Stopped'
      : 'Cleanup Complete';

  return (
    <div className="cs-page">
      <div className="cs-complete__title" style={{ marginTop: 'var(--cs-space-md)' }}>
        {title}
      </div>

      <StatsGrid stats={gridStats} />

      <div
        style={{
          textAlign: 'center',
          fontSize: 'var(--cs-font-size-sm)',
          color: 'var(--cs-text-tertiary)',
          marginTop: 'var(--cs-space-md)',
        }}
      >
        Duration: {elapsedStr}
      </div>

      <div className="cs-complete__actions">
        <button
          id="complete-another-btn"
          className="cs-btn cs-btn--primary cs-btn--full cs-btn--lg"
          onClick={onStartAnother}
          type="button"
        >
          Start Another Cleanup
        </button>
      </div>
    </div>
  );
}
