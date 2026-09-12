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

function getCategoryKey(category: ActivityCategory): string {
  return category === FacebookCategory.LikesReactions
    ? 'LIKEDPOSTS'
    : category === FacebookCategory.Comments
      ? 'COMMENTSCLUSTER'
      : category === FacebookCategory.Posts
        ? 'MANAGEPOSTSPHOTOSANDVIDEOS'
        : '';
}

function getFacebookProfileId(currentUrl: string): string | null {
  try {
    const url = new URL(currentUrl);
    const queryId = url.searchParams.get('id');
    if (queryId && /^\d+$/.test(queryId)) return queryId;

    const profilePath = url.pathname.match(/^\/(\d+)\/(?:allactivity)?/);
    return profilePath?.[1] || null;
  } catch {
    return null;
  }
}

function buildFacebookActivityUrl(category: ActivityCategory, profileId: string | null): string {
  const categoryKey = getCategoryKey(category);
  const target = new URL(
    `https://www.facebook.com/${profileId || 'me'}/allactivity`,
  );
  target.searchParams.set('activity_history', 'false');
  target.searchParams.set('category_key', categoryKey);
  target.searchParams.set('manage_mode', 'false');
  target.searchParams.set('should_load_landing_page', 'false');
  return target.toString();
}

function getDestination(category: ActivityCategory, profileId: string | null): { label: string; url: string; matches: (url: string) => boolean } {
  if (category === MessengerCategory.Conversations) {
    return {
      label: 'Messenger conversations',
      url: 'https://www.messenger.com/',
      matches: (url) => url.includes('messenger.com'),
    };
  }

  const url = buildFacebookActivityUrl(category, profileId);

  return {
    label: category.replace(/_/g, ' '),
    url: url.toString(),
    matches: (currentUrl) => {
      try {
        const current = new URL(currentUrl);
        if (!current.hostname.endsWith('facebook.com')) return false;

        const isActivityLog =
          current.pathname.includes('/me/allactivity') ||
          /^\/\d+\/allactivity/.test(current.pathname) ||
          (current.pathname === '/profile.php' &&
            current.searchParams.get('sk')?.toLowerCase() === 'allactivity');
        // Facebook may strip or rewrite category_key after loading the Activity
        // Log. The content script verifies/selects the visible category UI.
        return isActivityLog;
      } catch {
        return false;
      }
    },
  };
}

export function GuidedCleanupPage({ category, onStart, onCancel }: GuidedCleanupPageProps) {
  const [currentUrl, setCurrentUrl] = useState('');
  const [message, setMessage] = useState('');
  const [pageKind, setPageKind] = useState<'specific' | 'default' | 'other' | 'unknown'>('unknown');
  const profileId = getFacebookProfileId(currentUrl) ||
    currentUrl.match(/cleanslate-profile=(\d+)/)?.[1] ||
    null;
  const destination = useMemo(
    () => getDestination(category, profileId),
    [category, profileId],
  );

  const refreshPageCheck = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    let nextUrl = activeTab?.url || '';
    let nextPageKind: typeof pageKind = 'other';
    if (activeTab?.id && nextUrl.includes('facebook.com')) {
      try {
        const activityContext = await chrome.tabs.sendMessage(activeTab.id, {
          type: 'GET_ACTIVITY_CONTEXT',
          category,
        }) as { url?: string; page?: 'activity-category' | 'activity-default' | 'other' };
        if (activityContext.url) nextUrl = activityContext.url;
        nextPageKind =
          activityContext.page === 'activity-category'
            ? 'specific'
            : activityContext.page === 'activity-default'
              ? 'default'
              : 'other';
      } catch {
        // Fall back to URL/profile checks when the content script is unavailable.
      }
      try {
        const context = await chrome.tabs.sendMessage(activeTab.id, {
          type: 'GET_PROFILE_CONTEXT',
        }) as { profileId?: string; url?: string };
        if (context.url) nextUrl = context.url;
        if (context.profileId && category !== MessengerCategory.Conversations) {
          setCurrentUrl(`${nextUrl}#cleanslate-profile=${context.profileId}`);
          setPageKind(nextPageKind);
          return;
        }
      } catch {
        // Use the tab URL when the content script is unavailable.
      }
    }
    setCurrentUrl(nextUrl);
    setPageKind(nextPageKind);
  };

  useEffect(() => {
    refreshPageCheck();
    const timer = window.setInterval(refreshPageCheck, 800);
    return () => window.clearInterval(timer);
  }, [category]);

  const isCorrectPage =
    category === MessengerCategory.Conversations
      ? destination.matches(currentUrl)
      : pageKind === 'specific';

  const openDestination = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    let targetProfileId = getFacebookProfileId(activeTab?.url || '') || profileId;
    if (
      activeTab?.id &&
      activeTab.url?.includes('facebook.com') &&
      category !== MessengerCategory.Conversations
    ) {
      try {
        const context = await chrome.tabs.sendMessage(activeTab.id, {
          type: 'GET_PROFILE_CONTEXT',
        }) as { profileId?: string };
        targetProfileId = context.profileId || targetProfileId;
      } catch {
        // Fall back to the profile ID already visible in the tab URL.
      }
    }
    const targetUrl =
      category === MessengerCategory.Conversations
        ? destination.url
        : buildFacebookActivityUrl(category, targetProfileId);

    if (activeTab?.id) {
      await chrome.tabs.update(activeTab.id, { url: targetUrl });
    } else {
      await chrome.tabs.create({ url: targetUrl });
    }
  };

  const verifyAndStart = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, () => {
      if (!isCorrectPage) {
        void refreshPageCheck();
        setMessage(
          pageKind === 'default'
            ? `You are on Facebook's general Activity Log. Open the specific ${destination.label} category before scanning.`
            : `Open the specific ${destination.label} page first. CleanSlate will not scan this page.`,
        );
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
        <div
          className="cs-settings__label-desc"
          style={{ marginTop: 'var(--cs-space-sm)', color: 'var(--cs-warning-400)' }}
        >
          Facebook may need two clicks on “Open correct page” before the specific category
          finishes loading. If the first click opens the general Activity Log, click it again.
        </div>
      </div>

      <div className="cs-card" style={{ padding: 'var(--cs-space-md)', marginBottom: 'var(--cs-space-md)' }}>
        <div style={{ fontSize: 'var(--cs-font-size-xs)', color: 'var(--cs-text-tertiary)', marginBottom: 'var(--cs-space-xs)' }}>
          CURRENT PAGE
        </div>
        <div
          style={{
            color: isCorrectPage ? 'var(--cs-success-400)' : 'var(--cs-text-primary)',
            fontWeight: 700,
          }}
        >
          {isCorrectPage
            ? `Specific ${destination.label} page`
            : pageKind === 'default'
              ? 'Facebook default Activity Log page'
              : pageKind === 'other'
                ? 'Not on the Facebook Activity Log page'
                : 'Checking the current page…'}
        </div>
        <div
          style={{
            marginTop: 'var(--cs-space-xs)',
            color: 'var(--cs-text-secondary)',
            fontSize: 'var(--cs-font-size-sm)',
          }}
        >
          {isCorrectPage
            ? 'The requested category is selected and ready to load.'
            : pageKind === 'default'
              ? `Facebook opened the general log. Open the specific ${destination.label} page.`
              : pageKind === 'other'
                ? `Open the specific ${destination.label} page before scanning.`
                : 'Waiting for Facebook to finish loading its activity page.'}
        </div>
      </div>

      <div className="cs-card" style={{ padding: 'var(--cs-space-md)', marginBottom: 'var(--cs-space-md)' }}>
        <div style={{ fontWeight: 700, marginBottom: 'var(--cs-space-xs)' }}>
          How selection works
        </div>
        <div className="cs-settings__label-desc">
          Facebook’s native <strong>All</strong> checkbox selects the loaded activity. CleanSlate
          then uses Facebook’s own <strong>Remove</strong> button and confirmation.
        </div>
      </div>

      {message && (
        <div className="cs-card" style={{ padding: 'var(--cs-space-md)', marginBottom: 'var(--cs-space-md)' }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cs-space-sm)' }}>
        {category !== MessengerCategory.Conversations && (
          <button className="cs-btn cs-btn--primary cs-btn--full" onClick={openDestination} type="button">
            {isCorrectPage ? 'Open specific page again' : 'Open specific page'}
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
