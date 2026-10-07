export type Tab = 'home' | 'expenses' | 'add' | 'budgets' | 'more';

export type ExpenseCategory = 
  | 'Food' 
  | 'Travel' 
  | 'Rent' 
  | 'Bills' 
  | 'Shopping' 
  | 'Medical' 
  | 'Family' 
  | 'Coffee & Snacks' 
  | 'Entertainment' 
  | 'EMI/Loan' 
  | 'Subscription' 
  | 'Other';

export type PaymentMethod =
  | 'Cash'
  | 'UPI'
  | 'Debit Card'
  | 'Credit Card'
  | 'Bank Transfer'
  | 'Other';

export interface Expense {
  id: string;
  amountInPaise: number;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
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
