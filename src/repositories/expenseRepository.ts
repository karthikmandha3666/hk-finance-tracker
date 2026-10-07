import { db } from '../db/db';
import { Expense } from '../types';

export const expenseRepository = {
  /**
   * Adds a new validated expense to IndexedDB.
   */
  async addExpense(expense: Expense): Promise<string> {
    await db.expenses.add(expense);
    return expense.id;
  },

  /**
   * Retrieves all expenses sorted descending by date.
   */
  async getExpenses(): Promise<Expense[]> {
    return db.expenses.orderBy('date').reverse().toArray();
  },

  /**
   * Retrieves expenses within an inclusive date range [startDate, endDate].
   */
  async getExpensesByDateRange(startDate: string, endDate: string): Promise<Expense[]> {
    const expenses = await db.expenses
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();

    return expenses.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });
  },

  /**
   * Retrieves expenses for a given month (e.g. '2026-10').
   */
  async getExpensesByMonth(monthId: string): Promise<Expense[]> {
    const expenses = await db.expenses
      .where('date')
      .startsWith(monthId)
      .toArray();

    return expenses.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });
  },

  /**
   * Retrieves expenses for today's local date.
   */
  async getExpensesForToday(todayDateStr: string): Promise<Expense[]> {
    return db.expenses.where('date').equals(todayDateStr).toArray();
  },
};
