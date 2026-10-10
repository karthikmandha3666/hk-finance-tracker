import { describe, it, expect } from 'vitest';
import {
  evaluateBudgetStatus,
  analyzeCategoryBudgets,
  calculateMonthlyBudgetComparison,
} from './budgets';
import { Expense } from '../types';

describe('Smart Budget Management (Stage 12)', () => {
  describe('evaluateBudgetStatus', () => {
    it('evaluates status levels according to thresholds', () => {
      // 50% used -> within-budget
      expect(evaluateBudgetStatus(50000, 100000).status).toBe('within-budget');

      // 79.9% used -> within-budget
      expect(evaluateBudgetStatus(79900, 100000).status).toBe('within-budget');

      // 80% used -> approaching-limit
      expect(evaluateBudgetStatus(80000, 100000).status).toBe('approaching-limit');

      // 95% used -> approaching-limit
      expect(evaluateBudgetStatus(95000, 100000).status).toBe('approaching-limit');

      // 100% used -> budget-reached
      expect(evaluateBudgetStatus(100000, 100000).status).toBe('budget-reached');

      // 105% used -> over-budget
      expect(evaluateBudgetStatus(105000, 100000).status).toBe('over-budget');

      // null budget -> no-budget
      expect(evaluateBudgetStatus(50000, null).status).toBe('no-budget');

      // Zero budget with spending -> over-budget
      expect(evaluateBudgetStatus(500, 0).status).toBe('over-budget');

      // Zero budget with 0 spending -> within-budget
      expect(evaluateBudgetStatus(0, 0).status).toBe('within-budget');
    });
  });

  describe('analyzeCategoryBudgets', () => {
    const expenses: Expense[] = [
      {
        id: '1',
        amountInPaise: 450000, // ₹4,500
        category: 'Food',
        paymentMethod: 'UPI',
        date: '2026-10-01',
        note: '',
        currency: 'INR',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '2',
        amountInPaise: 1200000, // ₹12,000 (Over budget)
        category: 'Shopping',
        paymentMethod: 'Card',
        date: '2026-10-02',
        note: '',
        currency: 'INR',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '3',
        amountInPaise: 850000, // ₹8,500 (Approaching limit)
        category: 'Bills',
        paymentMethod: 'Net Banking',
        date: '2026-10-03',
        note: '',
        currency: 'INR',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '4',
        amountInPaise: 100000, // ₹1,000 (No budget configured)
        category: 'Travel',
        paymentMethod: 'Cash',
        date: '2026-10-04',
        note: '',
        currency: 'INR',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const categoryBudgets: Record<string, number> = {
      Food: 1000000, // ₹10,000 limit -> 45% (within-budget)
      Shopping: 1000000, // ₹10,000 limit -> 120% (over-budget by ₹2,000)
      Bills: 1000000, // ₹10,000 limit -> 85% (approaching-limit)
    };

    it('ranks and categorizes budgets with remaining and exceeded balances', () => {
      const results = analyzeCategoryBudgets(expenses, categoryBudgets);
      expect(results).toHaveLength(4);

      // Over budget should be ranked first
      expect(results[0].category).toBe('Shopping');
      expect(results[0].status).toBe('over-budget');
      expect(results[0].exceededPaise).toBe(200000);
      expect(results[0].remainingPaise).toBeNull();
      expect(results[0].visualPercent).toBe(100);

      // Approaching limit should be ranked second
      expect(results[1].category).toBe('Bills');
      expect(results[1].status).toBe('approaching-limit');
      expect(results[1].remainingPaise).toBe(150000);
      expect(results[1].utilizationPercent).toBe(85);

      // Within budget
      expect(results[2].category).toBe('Food');
      expect(results[2].status).toBe('within-budget');
      expect(results[2].remainingPaise).toBe(550000);

      // No budget configured
      expect(results[3].category).toBe('Travel');
      expect(results[3].status).toBe('no-budget');
      expect(results[3].remainingPaise).toBeNull();
    });
  });

  describe('calculateMonthlyBudgetComparison', () => {
    it('computes budget targets and spending changes between consecutive months', () => {
      const curExpenses: Expense[] = [
        {
          id: '1',
          amountInPaise: 500000, // ₹5,000
          category: 'Food',
          paymentMethod: 'UPI',
          date: '2026-10-01',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
      ];
      const prevExpenses: Expense[] = [
        {
          id: '2',
          amountInPaise: 400000, // ₹4,000
          category: 'Food',
          paymentMethod: 'UPI',
          date: '2026-09-01',
          note: '',
          currency: 'INR',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const comp = calculateMonthlyBudgetComparison(
        1000000, // Current budget: ₹10,000
        800000, // Previous budget: ₹8,000
        curExpenses,
        prevExpenses
      );

      expect(comp.budgetChangePaise).toBe(200000); // +₹2,000 budget
      expect(comp.spendingChangePaise).toBe(100000); // +₹1,000 spending
      expect(comp.currentUtilizationPercent).toBe(50); // 5000 / 10000
      expect(comp.previousUtilizationPercent).toBe(50); // 4000 / 8000
    });
  });
});
