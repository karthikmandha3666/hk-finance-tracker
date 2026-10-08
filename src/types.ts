export type Tab = 'home' | 'expenses' | 'add' | 'budgets' | 'more';

export type ExpenseCategory = string;

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface PaymentMethod {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface Expense {
  id: string;
  amountInPaise: number;
  category: string;
  paymentMethod: string;
  date: string; // YYYY-MM-DD, local calendar date
  note: string;
  currency: 'INR';
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface MonthData {
  id: string; // 'YYYY-MM'
  label: string; // e.g. 'October 2026'
  shortLabel: string; // e.g. 'Oct 2026'
  isCurrentMonth: boolean;
}

export interface MonthlySettings {
  id: string;
  monthId: string; // 'YYYY-MM' (e.g. '2026-10')
  incomeInPaise: number | null;
  budgetInPaise: number | null;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
