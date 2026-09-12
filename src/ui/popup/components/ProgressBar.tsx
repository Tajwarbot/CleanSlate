/**
 * ProgressBar — animated fill bar with percentage.
 */

interface ProgressBarProps {
  /** 0 to 100 */
  percentage: number;
  /** Visual variant */
  variant?: 'default' | 'success' | 'complete';
}

export function ProgressBar({ percentage, variant = 'default' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const fillClass = [
    'cs-progress__fill',
    variant === 'success' && 'cs-progress__fill--success',
    variant === 'complete' && 'cs-progress__fill--complete',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="cs-progress"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={fillClass} style={{ width: `${clamped}%` }} />
    </div>
  );
}
