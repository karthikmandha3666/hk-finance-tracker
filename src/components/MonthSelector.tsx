import React, { useMemo } from 'react';
import { MonthData } from '../types';
import { getPreviousMonthId, getNextMonthId } from '../utils/finance';
import { formatMonthData } from '../sampleData';

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
  const currentMonth = useMemo(() => {
    const found = months.find((m) => m.id === selectedMonthId);
    if (found) return found;
    return formatMonthData(selectedMonthId);
  }, [months, selectedMonthId]);

  const handlePrev = () => {
    onSelectMonth(getPreviousMonthId(selectedMonthId));
  };

  const handleNext = () => {
    onSelectMonth(getNextMonthId(selectedMonthId));
  };

  return (
    <div className="month-selector-bar" role="navigation" aria-label="Month Navigation">
      <button
        type="button"
        className="month-nav-btn"
        onClick={handlePrev}
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
        aria-label="Next month"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
};
