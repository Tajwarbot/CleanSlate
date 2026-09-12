/**
 * CategoryCard — interactive card for selecting an activity category.
 */

interface CategoryCardProps {
  icon?: string;
  name: string;
  description: string;
  selected?: boolean;
  onClick?: () => void;
  id: string;
}

export function CategoryCard({
  icon,
  name,
  description,
  selected,
  onClick,
  id,
}: CategoryCardProps) {
  const className = [
    'cs-category-card',
    selected && 'cs-category-card--selected',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      id={id}
      className={className}
      onClick={onClick}
      type="button"
      aria-pressed={selected}
    >
      {icon && (
        <div className="cs-category-card__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <div className="cs-category-card__info">
        <div className="cs-category-card__name">{name}</div>
        <div className="cs-category-card__desc">{description}</div>
      </div>
    </button>
  );
}
