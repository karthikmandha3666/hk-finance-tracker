import type { Expense } from '../types';

export const MAX_AMOUNT_RUPEES = 1000000; // ₹10,00,000 (10 Lakh)
export const MAX_AMOUNT_PAISE = MAX_AMOUNT_RUPEES * 100; // 10,00,000 * 100 paise

/**
 * Converts a rupees string (e.g. "250.50", "250", "0.5") into integer paise (25050, 25000, 50).
 * Uses string splitting and integer math to strictly prevent floating-point precision issues.
 */
export const rupeesToPaise = (rupeesStr: string): number => {
  const trimmed = rupeesStr.trim();
  if (!trimmed) return 0;

  if (trimmed.includes('.')) {
    const [intPart, decPart = ''] = trimmed.split('.');
    const intVal = parseInt(intPart || '0', 10);
    // Pad to 2 places and slice exactly 2 decimal digits
    const decVal = parseInt((decPart + '00').slice(0, 2), 10);
    return intVal * 100 + decVal;
  }

  const intVal = parseInt(trimmed, 10);
  return isNaN(intVal) ? 0 : intVal * 100;
};

/**
 * Formats an integer amount in paise into an Indian Rupee string with proper grouping.
 * E.g. 25000 -> "250", 25050 -> "250.50", 100000000 -> "10,00,000".
 */
export const formatPaiseToRupees = (paise: number): string => {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remPaise = absPaise % 100;

  const formattedRupees = rupees.toLocaleString('en-IN');
  const result = remPaise > 0
    ? `${formattedRupees}.${String(remPaise).padStart(2, '0')}`
    : formattedRupees;

  return isNegative ? `-${result}` : result;
};

/**
 * Sums all expenses and returns the total in integer paise.
 */
export const sumExpenses = (expenses: Expense[]): number => {
  return expenses.reduce((acc, curr) => acc + curr.amountInPaise, 0);
};

/**
 * Calculates total spending for a specific local calendar date in paise.
 */
export const calculateTodaySpending = (expenses: Expense[], localTodayStr: string): number => {
  return expenses
    .filter((e) => e.date === localTodayStr)
    .reduce((acc, curr) => acc + curr.amountInPaise, 0);
};

/**
 * Calculates total spending for a specific month (e.g. "2026-10") in paise.
 */
export const calculateMonthlySpending = (expenses: Expense[], monthId: string): number => {
  return expenses
    .filter((e) => e.date.startsWith(monthId))
    .reduce((acc, curr) => acc + curr.amountInPaise, 0);
};

/**
 * Returns today's local date string in YYYY-MM-DD format (no UTC conversion).
 */
export const getLocalTodayDateString = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns the current local month ID in YYYY-MM format (no UTC conversion).
 */
export const getLocalCurrentMonthId = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Converts integer paise into an editable rupees string (e.g. 7500000 -> "75000", 25050 -> "250.50").
 * Pure integer arithmetic, zero floating-point imprecision.
 */
export const paiseToRupeesInput = (paise: number | null): string => {
  if (paise === null || paise === undefined) return '';
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const rem = absPaise % 100;

  let result = rupees.toString();
  if (rem > 0) {
    result += `.${String(rem).padStart(2, '0')}`;
  }
  return isNegative ? `-${result}` : result;
};

/**
 * Calculates calendar day difference between dateStr1 and dateStr2 (dateStr1 - dateStr2).
 * Uses local calendar dates to avoid timezone shifts.
 */
export const getDifferenceInCalendarDays = (dateStr1: string, dateStr2: string): number => {
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const [y2, m2, d2] = dateStr2.split('-').map(Number);
  const t1 = new Date(y1, m1 - 1, d1).getTime();
  const t2 = new Date(y2, m2 - 1, d2).getTime();
  const diffMs = t1 - t2;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Categorizes a due date relative to today's local date.
 */
export const getDueDateStatus = (
  dueDateStr: string,
  todayStr = getLocalTodayDateString()
): 'overdue' | 'today' | 'within-7-days' | 'later' => {
  if (dueDateStr < todayStr) return 'overdue';
  if (dueDateStr === todayStr) return 'today';
  const diffDays = getDifferenceInCalendarDays(dueDateStr, todayStr);
  if (diffDays <= 7) return 'within-7-days';
  return 'later';
};

/**
 * Deterministically advances a due date according to its recurrence frequency.
 * Handles month boundaries, year boundaries, leap years, and month-end clamping (e.g. Jan 31 -> Feb 28/29).
 */
export const advanceDueDate = (
  currentDateStr: string,
  frequency: 'One-time' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'
): string => {
  const [y, m, d] = currentDateStr.split('-').map(Number);

  switch (frequency) {
    case 'Daily': {
      const next = new Date(y, m - 1, d + 1);
      return getLocalTodayDateString(next);
    }
    case 'Weekly': {
      const next = new Date(y, m - 1, d + 7);
      return getLocalTodayDateString(next);
    }
    case 'Monthly': {
      let targetM = m + 1;
      let targetY = y;
      if (targetM > 12) {
        targetM = 1;
        targetY += 1;
      }
      // Clamping: max days in target month
      const maxDays = new Date(targetY, targetM, 0).getDate();
      const clampedDay = Math.min(d, maxDays);
      return `${targetY}-${String(targetM).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    }
    case 'Yearly': {
      const targetY = y + 1;
      const maxDays = new Date(targetY, m, 0).getDate();
      const clampedDay = Math.min(d, maxDays);
      return `${targetY}-${String(m).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    }
    case 'One-time':
    default:
      return currentDateStr;
  }
};

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Returns a human-friendly due date string relative to local today (e.g. "Today", "Tomorrow", "Oct 15").
 */
export const formatDueDateFriendly = (
  dueDateStr: string,
  todayStr = getLocalTodayDateString()
): string => {
  if (dueDateStr === todayStr) return 'Today';
  const diffDays = getDifferenceInCalendarDays(dueDateStr, todayStr);
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < -1) return `${Math.abs(diffDays)}d Overdue`;

  const [, m, d] = dueDateStr.split('-').map(Number);
  const monthName = SHORT_MONTHS[m - 1] || '';
  return `${monthName} ${d}`;
};
