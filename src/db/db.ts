import Dexie, { type Table } from 'dexie';
import { Expense, MonthlySettings, Category, PaymentMethod, RecurringPayment } from '../types';

export class HKFinanceDatabase extends Dexie {
  expenses!: Table<Expense, string>;
  monthlySettings!: Table<MonthlySettings, string>;
  categories!: Table<Category, string>;
  paymentMethods!: Table<PaymentMethod, string>;
  recurringPayments!: Table<RecurringPayment, string>;

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
    this.version(4).stores({
      recurringPayments: 'id, name, nextDueDate, frequency, category, paymentMethod, isActive, createdAt, updatedAt',
    });
  }
}

export const db = new HKFinanceDatabase();
