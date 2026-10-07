import Dexie, { type Table } from 'dexie';
import { Expense, MonthlySettings } from '../types';

export class HKFinanceDatabase extends Dexie {
  expenses!: Table<Expense, string>;
  monthlySettings!: Table<MonthlySettings, string>;

  constructor() {
    super('hk_finance_tracker_db');
    this.version(1).stores({
      expenses: 'id, date, category, paymentMethod, createdAt, updatedAt',
    });
    this.version(2).stores({
      monthlySettings: 'id, &monthId, createdAt, updatedAt',
    });
  }
}

export const db = new HKFinanceDatabase();
