import React from 'react';

interface HeaderProps {
  onAddClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onAddClick }) => {
  return (
    <header className="app-top-header">
      <div className="brand-group">
        <div className="brand-logo-mark" aria-hidden="true">
          <span>₹</span>
        </div>
        <div className="brand-titles">
          <h1 className="header-brand-title">Spendly</h1>
        </div>
      </div>

      <div className="header-actions">
        {onAddClick && (
          <button
            type="button"
            className="header-quick-add-btn"
            onClick={onAddClick}
            aria-label="Add new expense"
            title="Quick Add Expense"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
};
