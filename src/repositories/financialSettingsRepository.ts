import { db } from '../db/db';
import { MonthlySettings } from '../types';

export const financialSettingsRepository = {
  /**
   * Retrieves financial settings for a specific month (e.g. '2026-10').
   */
  async getMonthlySettings(monthId: string): Promise<MonthlySettings | undefined> {
    return db.monthlySettings.where('monthId').equals(monthId).first();
  },

  /**
   * Upserts complete monthly settings record.
   */
  async saveMonthlySettings(
    settings: Omit<MonthlySettings, 'createdAt' | 'updatedAt'> & Partial<Pick<MonthlySettings, 'createdAt' | 'updatedAt'>>
  ): Promise<string> {
    const existing = await db.monthlySettings.where('monthId').equals(settings.monthId).first();
    const now = new Date().toISOString();

    if (existing) {
      const updated: MonthlySettings = {
        ...existing,
        ...settings,
        id: existing.id,
        updatedAt: now,
      };
      await db.monthlySettings.put(updated);
      return existing.id;
    } else {
      const id = settings.id || crypto.randomUUID();
      const created: MonthlySettings = {
        id,
        monthId: settings.monthId,
        incomeInPaise: settings.incomeInPaise,
        budgetInPaise: settings.budgetInPaise,
        createdAt: settings.createdAt || now,
        updatedAt: now,
      };
      await db.monthlySettings.add(created);
      return id;
    }
  },

  /**
   * Updates only monthly income for a given month, preserving budget.
   */
  async updateMonthlyIncome(monthId: string, incomeInPaise: number | null): Promise<MonthlySettings> {
    const existing = await db.monthlySettings.where('monthId').equals(monthId).first();
    const now = new Date().toISOString();

    if (existing) {
      const updated: MonthlySettings = {
        ...existing,
        incomeInPaise,
        updatedAt: now,
      };
      await db.monthlySettings.put(updated);
      return updated;
    } else {
      const created: MonthlySettings = {
        id: crypto.randomUUID(),
        monthId,
        incomeInPaise,
        budgetInPaise: null,
        createdAt: now,
        updatedAt: now,
      };
      await db.monthlySettings.add(created);
      return created;
    }
  },

  /**
   * Updates only monthly budget for a given month, preserving income.
   */
  async updateMonthlyBudget(monthId: string, budgetInPaise: number | null): Promise<MonthlySettings> {
    const existing = await db.monthlySettings.where('monthId').equals(monthId).first();
    const now = new Date().toISOString();

    if (existing) {
      const updated: MonthlySettings = {
        ...existing,
        budgetInPaise,
        updatedAt: now,
      };
      await db.monthlySettings.put(updated);
      return updated;
    } else {
      const created: MonthlySettings = {
        id: crypto.randomUUID(),
        monthId,
        incomeInPaise: null,
        budgetInPaise,
        createdAt: now,
        updatedAt: now,
      };
      await db.monthlySettings.add(created);
      return created;
    }
  },
};
