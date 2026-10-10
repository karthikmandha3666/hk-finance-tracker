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
 * Formats any YYYY-MM month ID into a proper MonthData object dynamically.
 */
export const formatMonthData = (monthId: string): MonthData => {
  const [yStr, mStr] = monthId.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const now = new Date();
  const currentMonthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthIdx = (m >= 1 && m <= 12) ? m - 1 : 0;
  return {
    id: monthId,
    label: `${MONTH_NAMES[monthIdx] || mStr} ${y}`,
    shortLabel: `${SHORT_MONTH_NAMES[monthIdx] || mStr} ${y}`,
    isCurrentMonth: monthId === currentMonthId,
  };
};

/**
 * Dynamically generates rolling months relative to the local client date (no UTC conversion),
 * including past months, current month, and future months.
 */
export const getDynamicMonths = (pastCount = 24, futureCount = 12): MonthData[] => {
  const months: MonthData[] = [];
  const now = new Date();
  const currentMonthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (let i = pastCount; i >= -futureCount; i--) {
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

export const INITIAL_MONTHS: MonthData[] = getDynamicMonths(24, 12);
