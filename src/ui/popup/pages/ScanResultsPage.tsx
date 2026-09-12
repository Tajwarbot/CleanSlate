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

  const getActivityLogUrl = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('comment')) {
      return 'https://www.facebook.com/me/allactivity?category_key=COMMENTSCLUSTER';
    }
    if (c.includes('like') || c.includes('reaction')) {
      return 'https://www.facebook.com/me/allactivity?activity_history=false&category_key=LIKEDPOSTS&manage_mode=false&should_load_landing_page=false';
    }
    if (c.includes('post')) {
      return 'https://www.facebook.com/me/allactivity?activity_history=false&category_key=MANAGEPOSTSPHOTOSANDVIDEOS&manage_mode=false&should_load_landing_page=false';
    }
    return 'https://www.facebook.com/me/allactivity';
  };

  const openActivityLog = () => {
    const targetUrl = getActivityLogUrl(category);
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id && activeTab.url?.includes('facebook.com')) {
          chrome.tabs.update(activeTab.id, { url: targetUrl });
        } else {
          chrome.tabs.create({ url: targetUrl });
        }
      });
    } else {
      window.open(targetUrl, '_blank');
    }
  };

  return (
    <div className="cs-page cs-animate-fade-in">
      {/* Header */}
      <div className="cs-results__header">
        <div className="cs-results__title">Scan complete</div>
        <div className="cs-results__count">{items.length}</div>
        <div className="cs-results__subtitle">{categoryLabel} items found</div>
      </div>

      {items.length === 0 ? (
        <div className="cs-card" style={{ padding: 'var(--cs-space-lg)', textAlign: 'center', margin: 'var(--cs-space-md) 0' }}>
          <div style={{ fontWeight: 600, color: 'var(--cs-text-primary)', marginBottom: 'var(--cs-space-xs)' }}>
            No {categoryLabel} Found in Current View
          </div>
          <div style={{ fontSize: 'var(--cs-font-size-xs)', color: 'var(--cs-text-secondary)', lineHeight: 1.5, marginBottom: 'var(--cs-space-md)' }}>
            Please ensure you are on your Facebook Activity Log page for {categoryLabel} and that items have loaded into view.
          </div>
          <button
            type="button"
            className="cs-btn cs-btn--sm cs-btn--primary"
            style={{ width: '100%', marginBottom: 'var(--cs-space-xs)' }}
            onClick={openActivityLog}
          >
            Go to {categoryLabel} in Activity Log
          </button>
        </div>
      ) : (
        <>
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
        </>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cs-space-sm)' }}>
        {items.length > 0 && (
          <button
            id="results-continue-btn"
            className="cs-btn cs-btn--primary cs-btn--full cs-btn--lg"
            disabled={selectedIds.size === 0}
            onClick={() => onContinue([...selectedItems])}
            type="button"
          >
            Continue ({selectedIds.size})
          </button>
        )}
        <button
          id="results-cancel-btn"
          className={`cs-btn cs-btn--full ${items.length === 0 ? 'cs-btn--primary' : 'cs-btn--ghost'}`}
          onClick={onCancel}
          type="button"
        >
          {items.length === 0 ? 'Back to Dashboard' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}
