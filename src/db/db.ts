import Dexie, { type Table } from 'dexie';
import { Expense } from '../types';

export class HKFinanceDatabase extends Dexie {
  expenses!: Table<Expense, string>;

  constructor() {
    super('hk_finance_tracker_db');
    this.version(1).stores({
      expenses: 'id, date, category, paymentMethod, createdAt, updatedAt',
    });
  }
}

export const db = new HKFinanceDatabase();
