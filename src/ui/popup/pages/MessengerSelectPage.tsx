/**
 * MessengerSelectPage — Messenger-specific cleanup options.
 */

import { CategoryCard } from '../components/CategoryCard';
import { MessengerCategory } from '../../../types/common';

interface MessengerSelectPageProps {
  onOpenConversations: () => void;
  onCancel: () => void;
}

export function MessengerSelectPage({
  onOpenConversations,
  onCancel,
}: MessengerSelectPageProps) {
  return (
    <div className="cs-page cs-animate-fade-in">
      <div className="cs-activity__title">Select Messenger Cleanup</div>

      <div className="cs-activity__categories">
        <CategoryCard
          id={`category-${MessengerCategory.Conversations}`}
          name="Open conversation messages"
          description="Delete messages only from the chat you currently opened"
          onClick={onOpenConversations}
        />
      </div>

      <button
        id="messenger-cancel-btn"
        className="cs-btn cs-btn--ghost cs-btn--full"
        onClick={onCancel}
        type="button"
      >
        Cancel
      </button>
    </div>
  );
}
