import React from 'react';
import { Tab } from '../types';

interface PlaceholderViewProps {
  tab: Tab;
  onGoHome: () => void;
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({ tab, onGoHome }) => {
  const getTabDetails = () => {
    switch (tab) {
      case 'expenses':
        return {
          title: 'All Expenses',
          desc: 'Daily, monthly, and yearly grouped expense records will be integrated here.',
          tag: 'Planned for Upcoming Stages',
          icon: (
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          ),
        };
      case 'budgets':
        return {
          title: 'Budgets & Limits',
          desc: 'Monthly budgets, category allowances, and budget vs. actual analytics will be available here.',
          tag: 'Planned for Phase 4',
          icon: (
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
              <path d="M22 12A10 10 0 0 0 12 2v10z" />
            </svg>
          ),
        };
      case 'more':
        return {
          title: 'More & Settings',
          desc: 'Excel import/export, offline sync status, categories manager, and loan tracking.',
          tag: 'Planned for Phase 5',
          icon: (
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          ),
        };
      default:
        return {
          title: 'Coming Soon',
          desc: 'This feature is scheduled for a future stage.',
          tag: 'Coming Soon',
          icon: null,
        };
    }
  };

  const details = getTabDetails();

  return (
    <div className="placeholder-view">
      <div className="placeholder-card">
        <div className="placeholder-icon-badge" aria-hidden="true">
          {details.icon}
        </div>
        <span className="placeholder-tag">{details.tag}</span>
        <h2 className="placeholder-title">{details.title}</h2>
        <p className="placeholder-desc">{details.desc}</p>
        <button
          type="button"
          className="btn-return-home"
          onClick={onGoHome}
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};
