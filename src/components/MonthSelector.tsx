import React from 'react';
import { MonthData } from '../types';

interface MonthSelectorProps {
  months: MonthData[];
  selectedMonthId: string;
  onSelectMonth: (monthId: string) => void;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  months,
  selectedMonthId,
  onSelectMonth,
}) => {
  const currentIndex = months.findIndex((m) => m.id === selectedMonthId);
  const currentMonth = months[currentIndex] || months[months.length - 1];

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < months.length - 1;

  const handlePrev = () => {
    if (hasPrev) {
      onSelectMonth(months[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      onSelectMonth(months[currentIndex + 1].id);
    }
  };

  return (
    <div className="month-selector-bar" role="navigation" aria-label="Month Navigation">
      <button
        type="button"
        className="month-nav-btn"
        onClick={handlePrev}
        disabled={!hasPrev}
        aria-label="Previous month"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="month-selector-label">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="month-name-text">{currentMonth.label}</span>
      </div>

      <button
        type="button"
        className="month-nav-btn"
        onClick={handleNext}
        disabled={!hasNext}
        aria-label="Next month"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
};
