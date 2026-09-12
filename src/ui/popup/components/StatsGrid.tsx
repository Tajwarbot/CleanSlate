/**
 * StatsGrid — 2-column grid displaying operation statistics.
 */

export interface StatItem {
  label: string;
  value: string | number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

interface StatsGridProps {
  stats: StatItem[];
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="cs-stats">
      {stats.map((stat) => {
        const valueClass = [
          'cs-stat__value',
          stat.variant === 'success' && 'cs-stat__value--success',
          stat.variant === 'warning' && 'cs-stat__value--warning',
          stat.variant === 'danger' && 'cs-stat__value--danger',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div className="cs-stat" key={stat.label}>
            <span className="cs-stat__label">{stat.label}</span>
            <span className={valueClass}>{stat.value}</span>
          </div>
        );
      })}
    </div>
  );
}
