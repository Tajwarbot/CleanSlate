/**
 * DashboardPage — landing page shown when the popup opens.
 *
 * Displays platform status, dry-run toggle, cleanup options,
 * recent cleanup summary, and interrupted session recovery.
 */

import { StatusBadge, type BadgeVariant } from '../components/StatusBadge';
import { CategoryCard } from '../components/CategoryCard';
import type { OperationState } from '../../../types/state';

interface InterruptedSession {
  operationId: string;
  category: string;
  processedItems: number;
  totalItems: number;
}

interface DashboardPageProps {
  operationState: OperationState;
  platform: string;
  dryRun: boolean;
  onDryRunToggle: () => void;
  onFacebookClick: () => void;
  onMessengerClick: () => void;
  interruptedSession: InterruptedSession | null;
  onReviewSession: () => void;
  onDiscardSession: () => void;
  lastCleanupCount: number | null;
}

function stateToVariant(state: OperationState): BadgeVariant {
  switch (state) {
    case 'IDLE':
    case 'COMPLETED':
      return 'ready';
    case 'SCANNING':
      return 'scanning';
    case 'EXECUTING':
    case 'VERIFYING':
      return 'processing';
    case 'SECURITY_CHALLENGE':
    case 'RATE_LIMITED':
    case 'ACTION_FAILED':
    case 'UI_CHANGED':
    case 'UNKNOWN_STATE':
      return 'error';
    default:
      return 'inactive';
  }
}

function stateToLabel(state: OperationState, platform: string): string {
  switch (state) {
    case 'IDLE':
      return platform !== 'unknown' ? 'Ready' : 'Not detected';
    case 'SCANNING':
      return 'Scanning…';
    case 'EXECUTING':
    case 'VERIFYING':
      return 'Processing…';
    case 'PAUSED':
      return 'Paused';
    case 'COMPLETED':
      return 'Ready';
    default:
      return 'Error';
  }
}

export function DashboardPage({
  operationState,
  platform,
  dryRun,
  onDryRunToggle,
  onFacebookClick,
  onMessengerClick,
  interruptedSession,
  onReviewSession,
  onDiscardSession,
  lastCleanupCount,
}: DashboardPageProps) {
  const variant = stateToVariant(operationState);
  const label = stateToLabel(operationState, platform);
  const platformLabel =
    platform === 'facebook' ? 'Facebook' : platform === 'messenger' ? 'Messenger' : '—';

  return (
    <div className="cs-page cs-animate-fade-in">
      {/* Status Row */}
      <div className="cs-dashboard__status">
        <div className="cs-dashboard__status-row">
          <span className="cs-dashboard__platform">{platformLabel}</span>
          <StatusBadge variant={variant} label={label} />
        </div>
      </div>

      {/* Safety preview toggle */}
      <div className="cs-dashboard__status-row" style={{ marginBottom: 'var(--cs-space-lg)' }}>
        <label className="cs-checkbox" htmlFor="dry-run-toggle">
          <input
            id="dry-run-toggle"
            type="checkbox"
            className="cs-toggle__input"
            checked={dryRun}
            onChange={onDryRunToggle}
          />
          <span className="cs-checkbox__label">Safety Preview Mode</span>
        </label>
      </div>

      {/* Interrupted Session Recovery */}
      {interruptedSession && (
        <div className="cs-card cs-animate-slide-up" style={{ marginBottom: 'var(--cs-space-xl)' }}>
          <div style={{ marginBottom: 'var(--cs-space-sm)', fontWeight: 600, color: 'var(--cs-warning-400)' }}>
            Previous cleanup interrupted
          </div>
          <div style={{ fontSize: 'var(--cs-font-size-sm)', color: 'var(--cs-text-secondary)', marginBottom: 'var(--cs-space-md)' }}>
            {interruptedSession.processedItems} of {interruptedSession.totalItems} items
            processed. CleanSlate will not resume automatically.
          </div>
          <div style={{ display: 'flex', gap: 'var(--cs-space-sm)' }}>
            <button
              id="session-review-btn"
              className="cs-btn cs-btn--sm cs-btn--primary"
              onClick={onReviewSession}
              type="button"
            >
              Review
            </button>
            <button
              id="session-discard-btn"
              className="cs-btn cs-btn--sm cs-btn--ghost"
              onClick={onDiscardSession}
              type="button"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* What to clean */}
      <div className="cs-dashboard__prompt">What do you want to clean?</div>

      <div className="cs-dashboard__actions">
        <CategoryCard
          id="facebook-activity-btn"
          name="Facebook Activity"
          description="Likes, comments, page likes, follows"
          onClick={onFacebookClick}
        />
        <CategoryCard
          id="messenger-btn"
          name="Messenger"
          description="Delete conversations"
          onClick={onMessengerClick}
        />
      </div>

      {/* Recent cleanup */}
      <div className="cs-dashboard__recent">
        <div className="cs-dashboard__recent-header">Recent cleanup</div>
        <div className="cs-dashboard__recent-stat">
          {lastCleanupCount !== null ? (
            <>
              <strong>{lastCleanupCount}</strong> items removed
            </>
          ) : (
            'No recent cleanup activity'
          )}
        </div>
      </div>
    </div>
  );
}
