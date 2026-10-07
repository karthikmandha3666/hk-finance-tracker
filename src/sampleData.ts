import { MonthData } from './types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Dynamically generates rolling months relative to the local client date (no UTC conversion).
 */
export const getDynamicMonths = (count = 6): MonthData[] => {
  const months: MonthData[] = [];
  const now = new Date();
  const currentMonthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const id = `${year}-${month}`;
    const label = `${MONTH_NAMES[d.getMonth()]} ${year}`;
    const shortLabel = `${SHORT_MONTH_NAMES[d.getMonth()]} ${year}`;

    months.push({
      id,
      label,
      shortLabel,
      isCurrentMonth: id === currentMonthId,
    });
  }

  return months;
};

export const INITIAL_MONTHS: MonthData[] = getDynamicMonths(6);
