import { describe, it, expect } from 'vitest';
import {
  calculateMonthOverMonthInsight,
  calculateCategoryInsights,
  detectUnusualCategorySpending,
  calculateSpendingTrends,
} from './insights';
import { Expense } from '../types';

describe('Financial Insights & Analytics (Stage 11)', () => {
  describe('calculateMonthOverMonthInsight', () => {
    it('calculates increase when current spending exceeds previous month', () => {
      // Current ₹5,000, Previous ₹4,000 (+₹1,000, +25%)
      const result = calculateMonthOverMonthInsight(500000, 400000, 'September 2026');
      expect(result.diffPaise).toBe(100000);
      expect(result.percentChange).toBe(25);
      expect(result.direction).toBe('increase');
      expect(result.description).toContain('Spent ₹1,000 (25%) more than September 2026');
    });

    it('calculates decrease when current spending is lower than previous month', () => {
      // Current ₹3,000, Previous ₹4,000 (-₹1,000, -25%)
      const result = calculateMonthOverMonthInsight(300000, 400000, 'September 2026');
      expect(result.diffPaise).toBe(-100000);
      expect(result.percentChange).toBe(25);
      expect(result.direction).toBe('decrease');
      expect(result.description).toContain('Saved ₹1,000 (25%) compared to September 2026');
    });

    it('handles zero previous month gracefully without division by zero', () => {
      const result = calculateMonthOverMonthInsight(250000, 0, 'September 2026');
      expect(result.diffPaise).toBe(250000);
      expect(result.percentChange).toBeNull();
      expect(result.direction).toBe('increase');
      expect(result.description).toContain('New spending of ₹2,500');
    });

    it('handles zero in both months as neutral', () => {
      const result = calculateMonthOverMonthInsight(0, 0);
      expect(result.diffPaise).toBe(0);
      expect(result.percentChange).toBe(0);
      expect(result.direction).toBe('neutral');
    });
  });

  describe('calculateCategoryInsights', () => {
    const currentExpenses: Expense[] = [
      {
        id: '1',
        amountInPaise: 400000, // ₹4,000
        category: 'Food',
        paymentMethod: 'UPI',
        date: '2026-10-05',
        note: '',
        currency: 'INR',
        createdAt: '2026-10-05T10:00:00Z',
        updatedAt: '2026-10-05T10:00:00Z',
      },
      {
        id: '2',
        amountInPaise: 600000, // ₹6,000
        category: 'Rent',
        paymentMethod: 'Net Banking',
        date: '2026-10-01',
        note: '',
        currency: 'INR',
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-01T10:00:00Z',
      },
    ];

    const prevExpenses: Expense[] = [
      {
        id: '3',
        amountInPaise: 200000, // ₹2,000
        category: 'Food',
        paymentMethod: 'UPI',
        date: '2026-09-05',
        note: '',
        currency: 'INR',
        createdAt: '2026-09-05T10:00:00Z',
        updatedAt: '2026-09-05T10:00:00Z',
      },
      {
        id: '4',
        amountInPaise: 300000, // ₹3,000
        category: 'Travel',
        paymentMethod: 'Card',
        date: '2026-09-10',
        note: '',
        currency: 'INR',
        createdAt: '2026-09-10T10:00:00Z',
        updatedAt: '2026-09-10T10:00:00Z',
      },
    ];

    it('computes category share and comparison accurately', () => {
      // Total current: ₹10,000 (Rent: 60%, Food: 40%)
      const insights = calculateCategoryInsights(currentExpenses, prevExpenses);
      expect(insights).toHaveLength(3);

      // Rent is highest in current
      expect(insights[0].category).toBe('Rent');
      expect(insights[0].currentPaise).toBe(600000);
      expect(insights[0].sharePercent).toBe(60);

      // Food has comparison with previous
      expect(insights[1].category).toBe('Food');
      expect(insights[1].currentPaise).toBe(400000);
      expect(insights[1].previousPaise).toBe(200000);
      expect(insights[1].diffPaise).toBe(200000);
      expect(insights[1].percentChange).toBe(100); // +100%

      // Travel was only in previous
      expect(insights[2].category).toBe('Travel');
      expect(insights[2].currentPaise).toBe(0);
      expect(insights[2].previousPaise).toBe(300000);
    });
  });

  describe('detectUnusualCategorySpending', () => {
    it('flags category when current spending is >30% and >=₹1,000 above 2+ month historical average', () => {
      const currentExpenses: Expense[] = [
        {
          id: 'c1',
          amountInPaise: 800000, // ₹8,000
          category: 'Shopping',
          paymentMethod: 'Card',
          date: '2026-10-10',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const historicalExpenses: Expense[] = [
        // Month 1: ₹3,000
        {
          id: 'h1',
          amountInPaise: 300000,
          category: 'Shopping',
          paymentMethod: 'Card',
          date: '2026-08-15',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
        // Month 2: ₹3,000
        {
          id: 'h2',
          amountInPaise: 300000,
          category: 'Shopping',
          paymentMethod: 'Card',
          date: '2026-09-15',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
      ];

      // Average is ₹3,000. Current is ₹8,000 (+₹5,000, +166.7%)
      const flags = detectUnusualCategorySpending(currentExpenses, historicalExpenses, '2026-10');
      expect(flags).toHaveLength(1);
      expect(flags[0].category).toBe('Shopping');
      expect(flags[0].currentPaise).toBe(800000);
      expect(flags[0].historicalAveragePaise).toBe(300000);
      expect(flags[0].percentAboveAverage).toBeGreaterThan(100);
    });

    it('suppresses flag when historical history is less than 2 months', () => {
      const currentExpenses: Expense[] = [
        {
          id: 'c1',
          amountInPaise: 900000,
          category: 'Medical',
          paymentMethod: 'UPI',
          date: '2026-10-10',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const onlyOneMonthHistory: Expense[] = [
        {
          id: 'h1',
          amountInPaise: 200000,
          category: 'Medical',
          paymentMethod: 'UPI',
          date: '2026-09-10',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const flags = detectUnusualCategorySpending(currentExpenses, onlyOneMonthHistory, '2026-10');
      expect(flags).toHaveLength(0); // Suppressed
    });

    it('suppresses flag when absolute increase is below minimum threshold (<₹1,000)', () => {
      const currentExpenses: Expense[] = [
        {
          id: 'c1',
          amountInPaise: 15000, // ₹150 (+₹50 above avg ₹100 = +50%, but only ₹50 delta)
          category: 'Coffee',
          paymentMethod: 'UPI',
          date: '2026-10-10',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const history: Expense[] = [
        {
          id: 'h1',
          amountInPaise: 10000,
          category: 'Coffee',
          paymentMethod: 'UPI',
          date: '2026-08-10',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'h2',
          amountInPaise: 10000,
          category: 'Coffee',
          paymentMethod: 'UPI',
          date: '2026-09-10',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const flags = detectUnusualCategorySpending(currentExpenses, history, '2026-10', 100000);
      expect(flags).toHaveLength(0);
    });
  });

  describe('calculateSpendingTrends', () => {
    it('returns sequential monthly trend bars with peak percentages', () => {
      const expenses: Expense[] = [
        {
          id: '1',
          amountInPaise: 200000, // ₹2,000 in Aug
          category: 'Food',
          paymentMethod: 'UPI',
          date: '2026-08-12',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: '2',
          amountInPaise: 500000, // ₹5,000 in Sep (Peak)
          category: 'Food',
          paymentMethod: 'UPI',
          date: '2026-09-12',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: '3',
          amountInPaise: 250000, // ₹2,500 in Oct
          category: 'Food',
          paymentMethod: 'UPI',
          date: '2026-10-12',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const trends = calculateSpendingTrends(expenses, '2026-10', 3);
      expect(trends).toHaveLength(3);

      expect(trends[0].monthId).toBe('2026-08');
      expect(trends[0].totalPaise).toBe(200000);
      expect(trends[0].percentageOfPeak).toBe(40); // 2000 / 5000

      expect(trends[1].monthId).toBe('2026-09');
      expect(trends[1].totalPaise).toBe(500000);
      expect(trends[1].percentageOfPeak).toBe(100); // Peak month

      expect(trends[2].monthId).toBe('2026-10');
      expect(trends[2].totalPaise).toBe(250000);
      expect(trends[2].percentageOfPeak).toBe(50);
      expect(trends[2].isCurrent).toBe(true);
    });
  });
});
