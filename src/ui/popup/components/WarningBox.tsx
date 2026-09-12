/**
 * WarningBox — alert box for warnings and danger notices.
 */

import type { ReactNode } from 'react';

interface WarningBoxProps {
  children: ReactNode;
  variant?: 'warning' | 'danger';
  icon?: string;
}

export function WarningBox({ children, variant = 'warning', icon }: WarningBoxProps) {
  const className = [
    'cs-warning',
    variant === 'danger' && 'cs-warning--danger',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} role="alert">
      <span className="cs-warning__icon" aria-hidden="true">
        {icon ?? (variant === 'danger' ? '🛑' : '⚠️')}
      </span>
      <span>{children}</span>
    </div>
  );
}
