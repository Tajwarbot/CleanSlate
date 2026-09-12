/**
 * ProgressPage — live progress display during cleanup execution.
 */

import { ProgressBar } from '../components/ProgressBar';
import { StatsGrid } from '../components/StatsGrid';
import type { OperationStats } from '../../../types/operations';

interface ProgressPageProps {
  stats: OperationStats | null;
  paused: boolean;
  dryRun: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function ProgressPage({
  stats,
  paused,
  dryRun,
  onPause,
  onResume,
  onStop,
}: ProgressPageProps) {
  const total = stats?.totalItems ?? 0;
  const processed = stats?.processedItems ?? 0;
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
  const batchInfo =
    stats ? `Batch ${stats.currentBatch} of ${stats.totalBatches}` : 'Preparing…';

  const elapsed = stats?.elapsedMs ?? 0;
  const elapsedStr = elapsed > 0 ? `${Math.round(elapsed / 1000)}s` : '—';

  const gridStats = [
    { label: 'Processed', value: processed },
    {
      label: 'Successful',
      value: stats?.successCount ?? 0,
      variant: 'success' as const,
    },
    {
      label: 'Skipped',
      value: stats?.skippedCount ?? 0,
      variant: 'warning' as const,
    },
    {
      label: 'Failed',
      value: stats?.failedCount ?? 0,
      variant: (stats?.failedCount ?? 0) > 0 ? ('danger' as const) : undefined,
    },
  ];

  return (
    <div className="cs-page">
      <div className="cs-progress-page__title">
        {dryRun ? 'Safety Preview in Progress' : paused ? 'Paused' : 'Cleaning up...'}
      </div>

      <ProgressBar percentage={percentage} variant={paused ? 'default' : 'success'} />

      <div className="cs-progress-page__percentage">{percentage}%</div>

      <div className="cs-progress-page__batch">
        {batchInfo} · {elapsedStr} elapsed
      </div>

      <StatsGrid stats={gridStats} />

      <div className="cs-progress-page__controls">
        {paused ? (
          <button
            id="progress-resume-btn"
            className="cs-btn cs-btn--primary"
            onClick={onResume}
            type="button"
          >
            Resume
          </button>
        ) : (
          <button
            id="progress-pause-btn"
            className="cs-btn"
            onClick={onPause}
            type="button"
          >
            Pause
          </button>
        )}
        <button
          id="progress-stop-btn"
          className="cs-btn cs-btn--danger"
          onClick={onStop}
          type="button"
        >
          STOP
        </button>
      </div>
    </div>
  );
}
