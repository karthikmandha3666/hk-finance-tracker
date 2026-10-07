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

export interface SampleExpense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  isToday?: boolean;
  paymentMethod: string;
  note: string;
  iconType: 'food' | 'travel' | 'coffee' | 'bills' | 'shopping' | 'rent' | 'entertainment';
}

export interface MonthData {
  id: string; // '2026-10', '2026-09', '2026-08'
  label: string; // 'October 2026'
  shortLabel: string; // 'Oct 2026'
  isCurrentMonth: boolean;
  expenses: SampleExpense[];
}
