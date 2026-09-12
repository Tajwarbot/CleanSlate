/**
 * Header — brand logo, title, and action buttons.
 */

import type { ReactNode } from 'react';

interface HeaderProps {
  onSettingsClick?: () => void;
  onBackClick?: () => void;
  showBack?: boolean;
  children?: ReactNode;
}

export function Header({ onSettingsClick, onBackClick, showBack }: HeaderProps) {
  return (
    <header className="cs-header">
      <div className="cs-header__brand">
        {showBack && (
          <button
            id="header-back-btn"
            className="cs-header__back-btn"
            onClick={onBackClick}
            aria-label="Go back"
            type="button"
          >
            ← Back
          </button>
        )}
        <h1 className="cs-header__title">CleanSlate</h1>
      </div>
      <div className="cs-header__actions">
        {onSettingsClick && (
          <button
            id="header-settings-btn"
            className="cs-header__settings-btn"
            onClick={onSettingsClick}
            aria-label="Settings"
            type="button"
          >
            Settings
          </button>
        )}
      </div>
    </header>
  );
}
