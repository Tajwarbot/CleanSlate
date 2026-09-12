/**
 * GuidedCleanupPage — verifies the destination before loading activity.
 */

import { useEffect, useMemo, useState } from 'react';
import { FacebookCategory, MessengerCategory, type ActivityCategory } from '../../../types/common';

interface GuidedCleanupPageProps {
  category: ActivityCategory;
  onStart: (category: ActivityCategory) => void;
  onCancel: () => void;
}

function getDestination(category: ActivityCategory): { label: string; url: string; matches: (url: string) => boolean } {
  if (category === MessengerCategory.Conversations) {
    return {
      label: 'Messenger conversations',
      url: 'https://www.messenger.com/',
      matches: (url) => url.includes('messenger.com'),
    };
  }

  const categoryKey =
    category === FacebookCategory.LikesReactions
      ? 'LIKESANDREACTIONSCLUSTER'
      : category === FacebookCategory.Comments
        ? 'COMMENTSCLUSTER'
        : '';
  const url = new URL('https://www.facebook.com/me/allactivity');
  if (categoryKey) url.searchParams.set('category_key', categoryKey);

  return {
    label: category.replace(/_/g, ' '),
    url: url.toString(),
    matches: (currentUrl) =>
      currentUrl.includes('facebook.com/me/allactivity') &&
      (!categoryKey || currentUrl.toUpperCase().includes(categoryKey)),
  };
}

export function GuidedCleanupPage({ category, onStart, onCancel }: GuidedCleanupPageProps) {
  const destination = useMemo(() => getDestination(category), [category]);
  const [currentUrl, setCurrentUrl] = useState('');
  const [message, setMessage] = useState('');

  const refreshPageCheck = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      setCurrentUrl(tabs[0]?.url || '');
    });
  };

  useEffect(() => {
    refreshPageCheck();
  }, []);

  const isCorrectPage = destination.matches(currentUrl);

  const openDestination = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id) {
        chrome.tabs.update(activeTab.id, { url: destination.url });
      } else {
        chrome.tabs.create({ url: destination.url });
      }
    });
  };

  const verifyAndStart = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      if (!destination.matches(url)) {
        setCurrentUrl(url);
        setMessage(`Open ${destination.label} first. CleanSlate will not scan this page.`);
        return;
      }
      setMessage('Correct page confirmed. Loading activity now…');
      onStart(category);
    });
  };

  return (
    <div className="cs-page cs-animate-fade-in">
      <div className="cs-activity__title">Clean {destination.label}</div>
      <div className="cs-card" style={{ padding: 'var(--cs-space-md)', marginBottom: 'var(--cs-space-md)' }}>
        <div style={{ fontWeight: 700, marginBottom: 'var(--cs-space-sm)' }}>Process</div>
        <div className="cs-settings__label-desc">1. Open the correct page</div>
        <div className="cs-settings__label-desc">2. Confirm you are there</div>
        <div className="cs-settings__label-desc">3. Load every visible item</div>
        <div className="cs-settings__label-desc">4. Review before cleanup</div>
      </div>

      <div className="cs-card" style={{ padding: 'var(--cs-space-md)', marginBottom: 'var(--cs-space-md)' }}>
        <div style={{ fontSize: 'var(--cs-font-size-xs)', color: 'var(--cs-text-tertiary)', marginBottom: 'var(--cs-space-xs)' }}>
          CURRENT PAGE
        </div>
        <div style={{ wordBreak: 'break-all', color: isCorrectPage ? 'var(--cs-success-400)' : 'var(--cs-text-secondary)' }}>
          {currentUrl || 'Unable to read the active tab'}
        </div>
        <div style={{ marginTop: 'var(--cs-space-sm)', fontWeight: 600 }}>
          {isCorrectPage ? 'Ready to load' : 'Wrong page'}
        </div>
      </div>

      {message && (
        <div className="cs-card" style={{ padding: 'var(--cs-space-md)', marginBottom: 'var(--cs-space-md)' }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cs-space-sm)' }}>
        {!isCorrectPage && (
          <button className="cs-btn cs-btn--primary cs-btn--full" onClick={openDestination} type="button">
            Open correct page
          </button>
        )}
        <button className="cs-btn cs-btn--primary cs-btn--full" onClick={verifyAndStart} type="button">
          {isCorrectPage ? 'Confirm page and start loading' : 'I am on the page — check again'}
        </button>
        <button className="cs-btn cs-btn--ghost cs-btn--full" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}
