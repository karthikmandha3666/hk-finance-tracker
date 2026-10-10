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

  const isNegative = trimmed.startsWith('-');
  const cleanStr = isNegative ? trimmed.slice(1).trim() : trimmed;
  if (!cleanStr) return 0;

  let totalPaise = 0;
  if (cleanStr.includes('.')) {
    const [intPart, decPart = ''] = cleanStr.split('.');
    const intVal = parseInt(intPart || '0', 10);
    const safeIntVal = isNaN(intVal) ? 0 : intVal;
    // Pad to 2 places and slice exactly 2 decimal digits
    const decVal = parseInt((decPart + '00').slice(0, 2), 10);
    const safeDecVal = isNaN(decVal) ? 0 : decVal;
    totalPaise = safeIntVal * 100 + safeDecVal;
  } else {
    const intVal = parseInt(cleanStr, 10);
    totalPaise = isNaN(intVal) ? 0 : intVal * 100;
  }

  if (totalPaise === 0) return 0;
  return isNegative ? -totalPaise : totalPaise;
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
 * Validates that a date string is strictly in YYYY-MM-DD format and represents a real calendar date.
 * Rejects non-strings, malformed strings, impossible days (e.g. Feb 30, Feb 31, Apr 31),
 * leap-year inconsistencies (e.g. Feb 29 on non-leap year), and invalid months.
 * Keeps valid dates stable without UTC/timezone conversion.
 */
export const isValidCalendarDate = (dateStr: string): boolean => {
  if (typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;

  const [yStr, mStr, dStr] = trimmed.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);

  if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  const dateObj = new Date(y, m - 1, d);
  return (
    dateObj.getFullYear() === y &&
    dateObj.getMonth() === m - 1 &&
    dateObj.getDate() === d
  );
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
  if (!dateStr1 || !dateStr2 || typeof dateStr1 !== 'string' || typeof dateStr2 !== 'string') {
    return 0;
  }
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
 * Preserves the original scheduled anchor day across short months (e.g. Jan 31 -> Feb 28 -> Mar 31).
 */
export const advanceDueDate = (
  currentDateStr: string,
  frequency: 'One-time' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly',
  anchorDay?: number
): string => {
  const [y, m, d] = currentDateStr.split('-').map(Number);
  const baseDay = (anchorDay !== undefined && anchorDay >= 1 && anchorDay <= 31) ? anchorDay : d;

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
      const clampedDay = Math.min(baseDay, maxDays);
      return `${targetY}-${String(targetM).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    }
    case 'Yearly': {
      const targetY = y + 1;
      const maxDays = new Date(targetY, m, 0).getDate();
      const clampedDay = Math.min(baseDay, maxDays);
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

/**
 * Calculates monthly EMI in integer paise using the standard reducing balance formula:
 * EMI = P * R * (1 + R)^N / ((1 + R)^N - 1)
 */
export const calculateEMIInPaise = (
  principalInPaise: number,
  annualInterestRatePercent: number,
  tenureMonths: number
): number => {
  if (principalInPaise <= 0 || tenureMonths <= 0) return 0;
  if (annualInterestRatePercent <= 0) {
    return Math.round(principalInPaise / tenureMonths);
  }
  const monthlyRate = annualInterestRatePercent / (12 * 100);
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  if (!isFinite(factor) || factor <= 1) {
    return Math.round(principalInPaise / tenureMonths);
  }
  const emi = (principalInPaise * monthlyRate * factor) / (factor - 1);
  return Math.round(emi);
};

/**
 * Formats day of month into an ordinal string, e.g. 5 -> "5th", 21 -> "21st".
 */
export const formatOrdinalDay = (day: number): string => {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
};

export interface CategorySpendingItem {
  category: string;
  totalPaise: number;
  percentage: number;
}

/**
 * Calculates category-wise spending aggregated from expenses and sorted descending.
 */
export const calculateCategorySpending = (expenses: { category: string; amountInPaise: number }[]): CategorySpendingItem[] => {
  const totals = new Map<string, number>();
  let totalSpending = 0;

  for (const exp of expenses) {
    const prev = totals.get(exp.category) || 0;
    totals.set(exp.category, prev + exp.amountInPaise);
    totalSpending += exp.amountInPaise;
  }

  const items: CategorySpendingItem[] = [];
  totals.forEach((totalPaise, category) => {
    const percentage = totalSpending > 0 ? Math.round((totalPaise / totalSpending) * 1000) / 10 : 0;
    items.push({ category, totalPaise, percentage });
  });

  return items.sort((a, b) => b.totalPaise - a.totalPaise);
};

/**
 * Returns previous calendar month in YYYY-MM format.
 */
export const getPreviousMonthId = (monthId: string): string => {
  const [yStr, mStr] = monthId.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10);
  m -= 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
};

/**
 * Returns next calendar month in YYYY-MM format.
 */
export const getNextMonthId = (monthId: string): string => {
  const [yStr, mStr] = monthId.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10);
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
};

export interface MonthOverMonthResult {
  diffPaise: number;
  percentChange: number | null;
  isIncrease: boolean;
}

/**
 * Calculates month-over-month comparison without dividing by zero.
 */
export const calculateMonthOverMonth = (
  currentMonthPaise: number,
  previousMonthPaise: number
): MonthOverMonthResult => {
  const diffPaise = currentMonthPaise - previousMonthPaise;
  if (previousMonthPaise === 0) {
    return {
      diffPaise,
      // When previous month is 0 and current is >0, return null to signal new spending without a fake +100%
      percentChange: currentMonthPaise > 0 ? null : 0,
      isIncrease: diffPaise > 0,
    };
  }
  const pct = Math.round((diffPaise / previousMonthPaise) * 1000) / 10;
  return {
    diffPaise,
    percentChange: Math.abs(pct),
    isIncrease: diffPaise > 0,
  };
};

export interface IncomeVsExpenseResult {
  netPaise: number | null;
  savingsRatePercent: number | null;
  isDeficit: boolean;
}

/**
 * Calculates income vs expense net savings and savings rate.
 */
export const calculateIncomeVsExpense = (
  incomePaise: number | null,
  expensePaise: number
): IncomeVsExpenseResult => {
  if (incomePaise === null) {
    return {
      netPaise: null,
      savingsRatePercent: null,
      isDeficit: false,
    };
  }
  const netPaise = incomePaise - expensePaise;
  const isDeficit = netPaise < 0;
  const savingsRatePercent =
    incomePaise > 0
      ? Math.round((netPaise / incomePaise) * 1000) / 10
      : 0;

  return {
    netPaise,
    savingsRatePercent,
    isDeficit,
  };
};

export interface BudgetMetrics {
  hasBudget: boolean;
  isZeroBudget: boolean;
  remainingBudgetPaise: number | null;
  isOverBudget: boolean;
  actualBudgetPercent: number | null;
  visualProgress: number;
  usageLabel: string | null;
  statusPill: string;
}

/**
 * Calculates budget metrics (usage percentage, visual progress, remaining amount, status pill).
 * Strictly guards against division by zero: when monthlyBudgetPaise is 0 or null,
 * actualBudgetPercent is null, preventing NaN and Infinity.
 */
export const calculateBudgetMetrics = (
  monthlyBudgetPaise: number | null,
  totalSpendingPaise: number
): BudgetMetrics => {
  const hasBudget = monthlyBudgetPaise !== null;
  const isZeroBudget = monthlyBudgetPaise === 0;
  const remainingBudgetPaise = hasBudget ? monthlyBudgetPaise - totalSpendingPaise : null;
  const isOverBudget = remainingBudgetPaise !== null && remainingBudgetPaise < 0;

  // Actual usage percentage (strictly avoids division by zero, NaN, or Infinity)
  const actualBudgetPercent =
    hasBudget && monthlyBudgetPaise > 0
      ? Math.round((totalSpendingPaise / monthlyBudgetPaise) * 1000) / 10
      : null;

  const visualProgress = isZeroBudget
    ? (totalSpendingPaise > 0 ? 100 : 0)
    : (actualBudgetPercent !== null ? Math.min(100, Math.max(0, actualBudgetPercent)) : 0);

  const usageLabel = isZeroBudget
    ? (totalSpendingPaise > 0
        ? `Over ₹0 limit by ₹${formatPaiseToRupees(totalSpendingPaise)}`
        : '0% used')
    : (actualBudgetPercent !== null
        ? `${actualBudgetPercent.toLocaleString('en-IN', { maximumFractionDigits: 1 })}% used`
        : null);

  const statusPill = isOverBudget
    ? (isZeroBudget ? 'Over ₹0 Limit' : 'Over Budget')
    : 'On Track';

  return {
    hasBudget,
    isZeroBudget,
    remainingBudgetPaise,
    isOverBudget,
    actualBudgetPercent,
    visualProgress,
    usageLabel,
    statusPill,
  };
};
