/**
 * ErrorPage — displays safety stops, security challenges, and other errors.
 */

interface ErrorPageProps {
  errorType: 'security_challenge' | 'rate_limited' | 'ui_changed' | 'max_failures' | 'unknown';
  message?: string;
  onAcknowledge: () => void;
}

const ERROR_CONFIG = {
  security_challenge: {
    icon: '🛡️',
    title: 'Security Challenge Detected',
    defaultMessage:
      'Facebook has presented a security or verification challenge. CleanSlate stopped the operation to protect your account. No attempt will be made to bypass the challenge.',
  },
  rate_limited: {
    icon: '⏱️',
    title: 'Rate Limit Detected',
    defaultMessage:
      'Facebook is throttling requests. CleanSlate stopped the operation to protect your account. Try again later with a smaller batch size.',
  },
  ui_changed: {
    icon: '🔄',
    title: 'Interface Changed',
    defaultMessage:
      'The Facebook interface appears to have changed unexpectedly. CleanSlate stopped to prevent unintended actions. The extension may need updating.',
  },
  max_failures: {
    icon: '❌',
    title: 'Too Many Failures',
    defaultMessage:
      'Multiple consecutive actions have failed. CleanSlate stopped to prevent further issues. Try again with a different category or later.',
  },
  unknown: {
    icon: '⚠️',
    title: 'Unexpected Error',
    defaultMessage:
      'An unexpected error occurred. CleanSlate stopped the operation as a precaution.',
  },
} as const;

export function ErrorPage({ errorType, message, onAcknowledge }: ErrorPageProps) {
  const config = ERROR_CONFIG[errorType];

  return (
    <div className="cs-page cs-animate-scale-in">
      <div className="cs-security-alert">
        <div className="cs-security-alert__icon">{config.icon}</div>
        <div className="cs-security-alert__title">{config.title}</div>
        <div className="cs-security-alert__message">
          {message ?? config.defaultMessage}
        </div>
        <button
          id="error-acknowledge-btn"
          className="cs-btn cs-btn--primary cs-btn--lg"
          onClick={onAcknowledge}
          type="button"
          style={{ marginTop: 'var(--cs-space-md)' }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
