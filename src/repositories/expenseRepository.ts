
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

  /**
   * Retrieves an expense by its unique ID.
   */
  async getExpenseById(id: string): Promise<Expense | undefined> {
    return db.expenses.get(id);
  },

  /**
   * Updates an existing expense in IndexedDB.
   */
  async updateExpense(expense: Expense): Promise<void> {
    const existing = await db.expenses.get(expense.id);
    if (!existing) {
      throw new Error(`Expense with id "${expense.id}" not found.`);
    }
    await db.expenses.put(expense);
  },

  /**
   * Deletes an expense by its unique ID.
   */
  async deleteExpense(id: string): Promise<void> {
    const existing = await db.expenses.get(id);
    if (!existing) {
      throw new Error(`Expense with id "${id}" not found.`);
    }
    await db.expenses.delete(id);
  },
};
