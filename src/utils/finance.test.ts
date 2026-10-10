import { describe, it, expect } from 'vitest';
import {
  rupeesToPaise,
  formatPaiseToRupees,
  sumExpenses,
  calculateMonthOverMonth,
  calculateIncomeVsExpense,
  getPreviousMonthId,
  getNextMonthId,
  formatOrdinalDay,
  isValidCalendarDate,
  calculateBudgetMetrics,
} from './finance';
import type { Expense } from '../types';

describe('finance utilities', () => {
  describe('rupeesToPaise negative decimal & positive parsing', () => {
    it('correctly converts positive whole numbers', () => {
      expect(rupeesToPaise('100')).toBe(10000);
      expect(rupeesToPaise('1')).toBe(100);
      expect(rupeesToPaise('0')).toBe(0);
    });

    it('correctly converts positive decimals', () => {
      expect(rupeesToPaise('100.50')).toBe(10050);
      expect(rupeesToPaise('100.5')).toBe(10050);
      expect(rupeesToPaise('0.05')).toBe(5);
      expect(rupeesToPaise('0.5')).toBe(50);
      expect(rupeesToPaise('0.50')).toBe(50);
      expect(rupeesToPaise('0.01')).toBe(1);
    });

    it('correctly converts negative decimals mathematically', () => {
      expect(rupeesToPaise('-100.50')).toBe(-10050);
      expect(rupeesToPaise('-100.5')).toBe(-10050);
      expect(rupeesToPaise('-0.05')).toBe(-5);
      expect(rupeesToPaise('-0.50')).toBe(-50);
      expect(rupeesToPaise('-0.5')).toBe(-50);
      expect(rupeesToPaise('-0.01')).toBe(-1);
    });

    it('correctly converts negative integers', () => {
      expect(rupeesToPaise('-100')).toBe(-10000);
      expect(rupeesToPaise('-1')).toBe(-100);
      expect(rupeesToPaise('-0')).toBe(0);
      expect(rupeesToPaise('-0.00')).toBe(0);
    });

    it('handles empty and whitespace strings gracefully', () => {
      expect(rupeesToPaise('')).toBe(0);
      expect(rupeesToPaise('   ')).toBe(0);
      expect(rupeesToPaise(' - ')).toBe(0);
    });
  });

  describe('formatPaiseToRupees', () => {
    it('formats positive integers with proper Indian comma grouping', () => {
      expect(formatPaiseToRupees(10000)).toBe('100');
      expect(formatPaiseToRupees(10000000)).toBe('1,00,000');
      expect(formatPaiseToRupees(10050)).toBe('100.50');
      expect(formatPaiseToRupees(5)).toBe('0.05');
      expect(formatPaiseToRupees(0)).toBe('0');
    });

    it('formats negative integers with leading negative sign and proper grouping', () => {
      expect(formatPaiseToRupees(-10000)).toBe('-100');
      expect(formatPaiseToRupees(-10050)).toBe('-100.50');
      expect(formatPaiseToRupees(-5)).toBe('-0.05');
      expect(formatPaiseToRupees(-10000000)).toBe('-1,00,000');
    });
  });

  describe('sumExpenses', () => {
    it('sums an array of expenses accurately in paise', () => {
      const expenses: Expense[] = [
        {
          id: '1',
          amountInPaise: 10050,
          category: 'Food',
          date: '2026-10-01',
          paymentMethod: 'UPI',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: '2',
          amountInPaise: 25000,
          category: 'Travel',
          date: '2026-10-02',
          paymentMethod: 'Cash',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
      ];
      expect(sumExpenses(expenses)).toBe(35050);
      expect(sumExpenses([])).toBe(0);
    });
  });

  describe('calculateMonthOverMonth', () => {
    it('calculates percentage increase correctly', () => {
      const result = calculateMonthOverMonth(15000, 10000);
      expect(result.diffPaise).toBe(5000);
      expect(result.isIncrease).toBe(true);
      expect(result.percentChange).toBe(50);
    });

    it('calculates percentage decrease correctly', () => {
      const result = calculateMonthOverMonth(5000, 10000);
      expect(result.diffPaise).toBe(-5000);
      expect(result.isIncrease).toBe(false);
      expect(result.percentChange).toBe(50);
    });

    it('safely handles previous month 0 paise without division by zero', () => {
      const result = calculateMonthOverMonth(5000, 0);
      expect(result.diffPaise).toBe(5000);
      expect(result.percentChange).toBeNull();
      expect(result.isIncrease).toBe(true);
    });

    it('safely handles both months 0 paise', () => {
      const result = calculateMonthOverMonth(0, 0);
      expect(result.diffPaise).toBe(0);
      expect(result.percentChange).toBe(0);
      expect(result.isIncrease).toBe(false);
    });
  });

  describe('calculateIncomeVsExpense', () => {
    it('calculates surplus and savings rate correctly', () => {
      const result = calculateIncomeVsExpense(1000000, 600000); // 10k income, 6k expense
      expect(result.netPaise).toBe(400000);
      expect(result.savingsRatePercent).toBe(40);
      expect(result.isDeficit).toBe(false);
    });

    it('calculates deficit correctly', () => {
      const result = calculateIncomeVsExpense(500000, 800000);
      expect(result.netPaise).toBe(-300000);
      expect(result.isDeficit).toBe(true);
    });

    it('handles null income', () => {
      const result = calculateIncomeVsExpense(null, 500000);
      expect(result.netPaise).toBeNull();
      expect(result.savingsRatePercent).toBeNull();
      expect(result.isDeficit).toBe(false);
    });
  });

  describe('month navigation and year boundary transitions', () => {
    it('advances month within the same year', () => {
      expect(getNextMonthId('2026-05')).toBe('2026-06');
    });

    it('crosses year boundary forward correctly', () => {
      expect(getNextMonthId('2026-12')).toBe('2027-01');
    });

    it('rewinds month within the same year', () => {
      expect(getPreviousMonthId('2026-06')).toBe('2026-05');
    });

    it('crosses year boundary backward correctly', () => {
      expect(getPreviousMonthId('2026-01')).toBe('2025-12');
    });
  });

  describe('formatOrdinalDay', () => {
    it('formats 1st, 2nd, 3rd, 4th through 31st correctly', () => {
      expect(formatOrdinalDay(1)).toBe('1st');
      expect(formatOrdinalDay(2)).toBe('2nd');
      expect(formatOrdinalDay(3)).toBe('3rd');
      expect(formatOrdinalDay(4)).toBe('4th');
      expect(formatOrdinalDay(11)).toBe('11th');
      expect(formatOrdinalDay(12)).toBe('12th');
      expect(formatOrdinalDay(13)).toBe('13th');
      expect(formatOrdinalDay(21)).toBe('21st');
      expect(formatOrdinalDay(22)).toBe('22nd');
      expect(formatOrdinalDay(23)).toBe('23rd');
      expect(formatOrdinalDay(31)).toBe('31st');
    });
  });

  describe('isValidCalendarDate (DEF-09)', () => {
    it('accepts standard valid dates in YYYY-MM-DD format', () => {
      expect(isValidCalendarDate('2026-10-10')).toBe(true);
      expect(isValidCalendarDate('2026-01-01')).toBe(true);
      expect(isValidCalendarDate('2026-12-31')).toBe(true);
      expect(isValidCalendarDate('2026-07-15')).toBe(true);
    });

    it('accepts valid month-end dates', () => {
      expect(isValidCalendarDate('2026-01-31')).toBe(true); // Jan has 31
      expect(isValidCalendarDate('2026-02-28')).toBe(true); // Non-leap Feb has 28
      expect(isValidCalendarDate('2026-03-31')).toBe(true); // Mar has 31
      expect(isValidCalendarDate('2026-04-30')).toBe(true); // Apr has 30
      expect(isValidCalendarDate('2026-05-31')).toBe(true); // May has 31
      expect(isValidCalendarDate('2026-06-30')).toBe(true); // Jun has 30
      expect(isValidCalendarDate('2026-07-31')).toBe(true); // Jul has 31
      expect(isValidCalendarDate('2026-08-31')).toBe(true); // Aug has 31
      expect(isValidCalendarDate('2026-09-30')).toBe(true); // Sep has 30
      expect(isValidCalendarDate('2026-10-31')).toBe(true); // Oct has 31
      expect(isValidCalendarDate('2026-11-30')).toBe(true); // Nov has 30
      expect(isValidCalendarDate('2026-12-31')).toBe(true); // Dec has 31
    });

    it('accepts leap year February 29 (2024, 2028, 2000)', () => {
      expect(isValidCalendarDate('2024-02-29')).toBe(true);
      expect(isValidCalendarDate('2028-02-29')).toBe(true);
      expect(isValidCalendarDate('2000-02-29')).toBe(true);
    });

    it('rejects February 29 on non-leap years (2025, 2026, 1900)', () => {
      expect(isValidCalendarDate('2025-02-29')).toBe(false);
      expect(isValidCalendarDate('2026-02-29')).toBe(false);
      expect(isValidCalendarDate('1900-02-29')).toBe(false);
    });

    it('rejects impossible dates like February 30 or February 31', () => {
      expect(isValidCalendarDate('2026-02-30')).toBe(false);
      expect(isValidCalendarDate('2026-02-31')).toBe(false);
      expect(isValidCalendarDate('2024-02-30')).toBe(false);
      expect(isValidCalendarDate('2024-02-31')).toBe(false);
    });

    it('rejects 31st on 30-day months (April, June, September, November)', () => {
      expect(isValidCalendarDate('2026-04-31')).toBe(false);
      expect(isValidCalendarDate('2026-06-31')).toBe(false);
      expect(isValidCalendarDate('2026-09-31')).toBe(false);
      expect(isValidCalendarDate('2026-11-31')).toBe(false);
    });

    it('rejects zero or negative days and months', () => {
      expect(isValidCalendarDate('2026-00-10')).toBe(false);
      expect(isValidCalendarDate('2026-01-00')).toBe(false);
      expect(isValidCalendarDate('2026-13-01')).toBe(false);
      expect(isValidCalendarDate('2026-01-32')).toBe(false);
    });

    it('rejects malformed and non-conforming date formats', () => {
      expect(isValidCalendarDate('')).toBe(false);
      expect(isValidCalendarDate('   ')).toBe(false);
      expect(isValidCalendarDate('2026/10/10')).toBe(false);
      expect(isValidCalendarDate('10-10-2026')).toBe(false);
      expect(isValidCalendarDate('2026-1-1')).toBe(false);
      expect(isValidCalendarDate('not-a-date')).toBe(false);
      expect(isValidCalendarDate(null as unknown as string)).toBe(false);
      expect(isValidCalendarDate(undefined as unknown as string)).toBe(false);
    });
  });

  describe('DEF-02 & MAS-03: Production calculateBudgetMetrics calculation', () => {
    it('distinguishes null (budget not set) from explicit 0 budget', () => {
      const nullBudget = calculateBudgetMetrics(null, 50000);
      expect(nullBudget.hasBudget).toBe(false);
      expect(nullBudget.isZeroBudget).toBe(false);
      expect(nullBudget.remainingBudgetPaise).toBeNull();
      expect(nullBudget.actualBudgetPercent).toBeNull();
      expect(nullBudget.visualProgress).toBe(0);
      expect(nullBudget.usageLabel).toBeNull();

      const zeroBudget = calculateBudgetMetrics(0, 0);
      expect(zeroBudget.hasBudget).toBe(true);
      expect(zeroBudget.isZeroBudget).toBe(true);
    });

    it('handles ₹0 budget with ₹0 spending: displays 0 remaining, 0% used, on-track', () => {
      const result = calculateBudgetMetrics(0, 0);
      expect(result.remainingBudgetPaise).toBe(0);
      expect(result.isOverBudget).toBe(false);
      expect(result.actualBudgetPercent).toBeNull(); // No NaN/Infinity
      expect(Number.isNaN(result.actualBudgetPercent)).toBe(false);
      expect(result.visualProgress).toBe(0);
      expect(result.usageLabel).toBe('0% used');
      expect(result.statusPill).toBe('On Track');
    });

    it('handles ₹0 budget with positive spending: displays actual deficit and over-zero-limit warning without NaN or Infinity', () => {
      const spendingPaise = 50000; // ₹500
      const result = calculateBudgetMetrics(0, spendingPaise);
      expect(result.remainingBudgetPaise).toBe(-50000);
      expect(result.isOverBudget).toBe(true);
      expect(result.actualBudgetPercent).toBeNull(); // Never divides by zero
      expect(Number.isNaN(result.actualBudgetPercent)).toBe(false);
      expect(result.visualProgress).toBe(100);
      expect(result.usageLabel).toBe('Over ₹0 limit by ₹500');
      expect(result.statusPill).toBe('Over ₹0 Limit');
    });

    it('preserves existing positive budget calculations when on track', () => {
      const budgetPaise = 1000000; // ₹10,000
      const spendingPaise = 400000; // ₹4,000
      const result = calculateBudgetMetrics(budgetPaise, spendingPaise);
      expect(result.remainingBudgetPaise).toBe(600000); // ₹6,000 remaining
      expect(result.isOverBudget).toBe(false);
      expect(result.actualBudgetPercent).toBe(40);
      expect(result.visualProgress).toBe(40);
      expect(result.usageLabel).toBe('40% used');
      expect(result.statusPill).toBe('On Track');
    });

    it('preserves existing positive budget calculations when over budget', () => {
      const budgetPaise = 1000000; // ₹10,000
      const spendingPaise = 1250000; // ₹12,500
      const result = calculateBudgetMetrics(budgetPaise, spendingPaise);
      expect(result.remainingBudgetPaise).toBe(-250000); // -₹2,500 deficit
      expect(result.isOverBudget).toBe(true);
      expect(result.actualBudgetPercent).toBe(125);
      expect(result.visualProgress).toBe(100); // Clamped for visual bar
      expect(result.usageLabel).toBe('125% used');
      expect(result.statusPill).toBe('Over Budget');
    });
  });
});
