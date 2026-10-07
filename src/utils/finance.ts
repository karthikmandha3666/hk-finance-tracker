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
