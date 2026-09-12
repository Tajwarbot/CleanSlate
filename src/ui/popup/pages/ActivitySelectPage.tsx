/**
 * ActivitySelectPage — category selection for Facebook activity cleanup.
 */

import { useState } from 'react';
import { CategoryCard } from '../components/CategoryCard';
import { FacebookCategory, type ActivityCategory } from '../../../types/common';

interface ActivitySelectPageProps {
  onScan: (category: ActivityCategory) => void;
  onCancel: () => void;
}

const CATEGORIES = [
  {
    value: FacebookCategory.LikesReactions,
    name: 'Likes & Reactions',
    description: 'Unlike posts and remove reactions',
  },
  {
    value: FacebookCategory.Comments,
    name: 'Comments',
    description: 'Delete your comments on posts',
  },
  {
    value: FacebookCategory.PageLikes,
    name: 'Page Likes',
    description: 'Unlike pages you have liked',
  },
  {
    value: FacebookCategory.Follows,
    name: 'Follows',
    description: 'Unfollow people and pages',
  },
] as const;

export function ActivitySelectPage({ onScan, onCancel }: ActivitySelectPageProps) {
  const [selected, setSelected] = useState<ActivityCategory | null>(null);

  return (
    <div className="cs-page cs-animate-fade-in">
      <div className="cs-activity__title">Select Activity Type</div>

      <div className="cs-activity__categories">
        {CATEGORIES.map((cat) => (
          <CategoryCard
            key={cat.value}
            id={`category-${cat.value}`}
            name={cat.name}
            description={cat.description}
            selected={selected === cat.value}
            onClick={() => setSelected(cat.value)}
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cs-space-sm)' }}>
        <button
          id="scan-activity-btn"
          className="cs-btn cs-btn--primary cs-btn--full cs-btn--lg"
          disabled={!selected}
          onClick={() => selected && onScan(selected)}
          type="button"
        >
          Scan Activity
        </button>
        <button
          id="activity-cancel-btn"
          className="cs-btn cs-btn--ghost cs-btn--full"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
