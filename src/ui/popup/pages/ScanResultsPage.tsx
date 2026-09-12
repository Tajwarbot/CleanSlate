/**
 * ScanResultsPage — preview of discovered items with selection controls.
 */

import { useState, useMemo } from 'react';
import type { CleanupItem } from '../../../types/operations';

interface ScanResultsPageProps {
  items: ReadonlyArray<CleanupItem>;
  category: string;
  onContinue: (selectedItems: CleanupItem[]) => void;
  onCancel: () => void;
}

export function ScanResultsPage({
  items,
  category,
  onContinue,
  onCancel,
}: ScanResultsPageProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(items.map((i) => i.id)),
  );

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(items.map((i) => i.id)));
  const clearAll = () => setSelectedIds(new Set());

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds],
  );

  const categoryLabel = category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="cs-page cs-animate-fade-in">
      {/* Header */}
      <div className="cs-results__header">
        <div className="cs-results__title">Scan complete</div>
        <div className="cs-results__count">{items.length}</div>
        <div className="cs-results__subtitle">{categoryLabel} items found</div>
      </div>

      {/* Selection controls */}
      <div className="cs-results__selection-actions">
        <button
          id="select-all-btn"
          className="cs-btn cs-btn--sm cs-btn--ghost"
          onClick={selectAll}
          type="button"
        >
          Select All
        </button>
        <button
          id="clear-selection-btn"
          className="cs-btn cs-btn--sm cs-btn--ghost"
          onClick={clearAll}
          type="button"
        >
          Clear Selection
        </button>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 'var(--cs-font-size-sm)',
            color: 'var(--cs-text-tertiary)',
            alignSelf: 'center',
          }}
        >
          {selectedIds.size} selected
        </span>
      </div>

      {/* Item list */}
      <div
        className="cs-results__breakdown"
        style={{ maxHeight: '200px', overflowY: 'auto' }}
      >
        {items.map((item) => (
          <label key={item.id} className="cs-checkbox" htmlFor={`item-${item.id}`}>
            <input
              id={`item-${item.id}`}
              type="checkbox"
              className="cs-checkbox__input"
              checked={selectedIds.has(item.id)}
              onChange={() => toggleItem(item.id)}
            />
            <span className="cs-checkbox__label">
              <span>{item.label}</span>
              {item.description && (
                <span
                  style={{
                    display: 'block',
                    fontSize: 'var(--cs-font-size-xs)',
                    color: 'var(--cs-text-tertiary)',
                  }}
                >
                  {item.description}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cs-space-sm)' }}>
        <button
          id="results-continue-btn"
          className="cs-btn cs-btn--primary cs-btn--full cs-btn--lg"
          disabled={selectedIds.size === 0}
          onClick={() => onContinue([...selectedItems])}
          type="button"
        >
          Continue ({selectedIds.size})
        </button>
        <button
          id="results-cancel-btn"
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
