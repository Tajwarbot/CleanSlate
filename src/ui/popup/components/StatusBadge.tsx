/**
 * StatusBadge — displays operation status with an animated dot.
 */

export type BadgeVariant = 'ready' | 'scanning' | 'processing' | 'error' | 'inactive';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
}

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  return (
    <span className={`cs-badge cs-badge--${variant}`} role="status">
      <span className="cs-badge__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
