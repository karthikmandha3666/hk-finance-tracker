import Dexie, { type Table } from 'dexie';
import { Expense, MonthlySettings, Category, PaymentMethod } from '../types';

export class HKFinanceDatabase extends Dexie {
  expenses!: Table<Expense, string>;
  monthlySettings!: Table<MonthlySettings, string>;
  categories!: Table<Category, string>;
  paymentMethods!: Table<PaymentMethod, string>;

  constructor() {
    super('hk_finance_tracker_db');
    this.version(1).stores({
      expenses: 'id, date, category, paymentMethod, createdAt, updatedAt',
    });
    this.version(2).stores({
      monthlySettings: 'id, &monthId, createdAt, updatedAt',
    });
    this.version(3).stores({
      categories: 'id, name, isActive, createdAt, updatedAt',
      paymentMethods: 'id, name, isActive, createdAt, updatedAt',
    });
  }
}

export const db = new HKFinanceDatabase();
