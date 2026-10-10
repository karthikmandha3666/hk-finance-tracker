import { HKFinanceDatabase } from '../db/db';
import {
  Expense,
  Category,
  PaymentMethod,
  RecurringPayment,
  Loan,
  MonthlySettings,
  RecurrenceFrequency,
} from '../types';
import { isValidCalendarDate } from './finance';

export interface BackupDataEnvelope {
  app: 'spendly';
  version: string;
  formatVersion: 1;
  exportedAt: string;
  data: {
    expenses: Expense[];
    categories: Category[];
    paymentMethods: PaymentMethod[];
    recurringPayments: RecurringPayment[];
    loans: Loan[];
    monthlySettings: MonthlySettings[];
  };
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  counts?: {
    expenses: number;
    categories: number;
    paymentMethods: number;
    recurringPayments: number;
    loans: number;
    monthlySettings: number;
  };
}

const VALID_FREQUENCIES: Set<RecurrenceFrequency> = new Set([
  'One-time',
  'Daily',
  'Weekly',
  'Monthly',
  'Yearly',
]);

const MONTH_ID_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Validates an unknown parsed JSON object against the Spendly Backup schema.
 * Rejects corrupt, modified, or out-of-spec payloads before touching the database.
 */
export function validateBackupPayload(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { isValid: false, error: 'Backup payload must be a valid JSON object.' };
  }

  const raw = payload as Partial<BackupDataEnvelope>;

  if (raw.app !== 'spendly') {
    return {
      isValid: false,
      error: `Invalid application signature. Expected "spendly", received "${String(raw.app)}".`,
    };
  }

  if (raw.formatVersion !== 1) {
    return {
      isValid: false,
      error: `Unsupported backup format version: ${String(raw.formatVersion)}. Supported version is 1.`,
    };
  }

  if (!raw.data || typeof raw.data !== 'object' || Array.isArray(raw.data)) {
    return { isValid: false, error: 'Backup payload is missing the "data" store container.' };
  }

  const { expenses, categories, paymentMethods, recurringPayments, loans, monthlySettings } =
    raw.data;

  if (!Array.isArray(expenses)) {
    return { isValid: false, error: 'The "expenses" store must be an array.' };
  }
  if (!Array.isArray(categories)) {
    return { isValid: false, error: 'The "categories" store must be an array.' };
  }
  if (!Array.isArray(paymentMethods)) {
    return { isValid: false, error: 'The "paymentMethods" store must be an array.' };
  }
  if (!Array.isArray(recurringPayments)) {
    return { isValid: false, error: 'The "recurringPayments" store must be an array.' };
  }
  if (!Array.isArray(loans)) {
    return { isValid: false, error: 'The "loans" store must be an array.' };
  }
  if (!Array.isArray(monthlySettings)) {
    return { isValid: false, error: 'The "monthlySettings" store must be an array.' };
  }

  // Check duplicate IDs and field schemas for Expenses
  const expenseIdSet = new Set<string>();
  for (let i = 0; i < expenses.length; i++) {
    const item = expenses[i] as Partial<Expense>;
    if (!item.id || typeof item.id !== 'string') {
      return { isValid: false, error: `Expense at index ${i} has an invalid or missing ID.` };
    }
    if (expenseIdSet.has(item.id)) {
      return { isValid: false, error: `Duplicate expense ID detected: "${item.id}".` };
    }
    expenseIdSet.add(item.id);

    if (
      typeof item.amountInPaise !== 'number' ||
      !Number.isInteger(item.amountInPaise) ||
      item.amountInPaise <= 0
    ) {
      return {
        isValid: false,
        error: `Expense "${item.id}" has invalid amountInPaise. Must be a positive integer.`,
      };
    }
    if (!item.date || typeof item.date !== 'string' || !isValidCalendarDate(item.date)) {
      return { isValid: false, error: `Expense "${item.id}" has an invalid date: "${item.date}".` };
    }
    if (!item.category || typeof item.category !== 'string') {
      return { isValid: false, error: `Expense "${item.id}" has a missing or invalid category.` };
    }
    if (!item.paymentMethod || typeof item.paymentMethod !== 'string') {
      return { isValid: false, error: `Expense "${item.id}" has a missing or invalid paymentMethod.` };
    }
  }

  // Categories
  const categoryIdSet = new Set<string>();
  for (let i = 0; i < categories.length; i++) {
    const item = categories[i] as Partial<Category>;
    if (!item.id || typeof item.id !== 'string') {
      return { isValid: false, error: `Category at index ${i} has an invalid or missing ID.` };
    }
    if (categoryIdSet.has(item.id)) {
      return { isValid: false, error: `Duplicate category ID detected: "${item.id}".` };
    }
    categoryIdSet.add(item.id);

    if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
      return { isValid: false, error: `Category "${item.id}" has an invalid name.` };
    }
    if (typeof item.isActive !== 'boolean') {
      return { isValid: false, error: `Category "${item.id}" has an invalid isActive flag.` };
    }
  }

  // Payment Methods
  const paymentMethodIdSet = new Set<string>();
  for (let i = 0; i < paymentMethods.length; i++) {
    const item = paymentMethods[i] as Partial<PaymentMethod>;
    if (!item.id || typeof item.id !== 'string') {
      return { isValid: false, error: `Payment method at index ${i} has an invalid or missing ID.` };
    }
    if (paymentMethodIdSet.has(item.id)) {
      return { isValid: false, error: `Duplicate payment method ID detected: "${item.id}".` };
    }
    paymentMethodIdSet.add(item.id);

    if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
      return { isValid: false, error: `Payment method "${item.id}" has an invalid name.` };
    }
    if (typeof item.isActive !== 'boolean') {
      return { isValid: false, error: `Payment method "${item.id}" has an invalid isActive flag.` };
    }
  }

  // Recurring Payments
  const recurringPaymentIdSet = new Set<string>();
  for (let i = 0; i < recurringPayments.length; i++) {
    const item = recurringPayments[i] as Partial<RecurringPayment>;
    if (!item.id || typeof item.id !== 'string') {
      return { isValid: false, error: `Recurring payment at index ${i} has an invalid or missing ID.` };
    }
    if (recurringPaymentIdSet.has(item.id)) {
      return { isValid: false, error: `Duplicate recurring payment ID detected: "${item.id}".` };
    }
    recurringPaymentIdSet.add(item.id);

    if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
      return { isValid: false, error: `Recurring payment "${item.id}" has an invalid name.` };
    }
    if (
      typeof item.amountInPaise !== 'number' ||
      !Number.isInteger(item.amountInPaise) ||
      item.amountInPaise <= 0
    ) {
      return {
        isValid: false,
        error: `Recurring payment "${item.id}" has invalid amountInPaise. Must be a positive integer.`,
      };
    }
    if (!item.frequency || !VALID_FREQUENCIES.has(item.frequency)) {
      return {
        isValid: false,
        error: `Recurring payment "${item.id}" has an invalid frequency: "${String(item.frequency)}".`,
      };
    }
    if (!item.nextDueDate || typeof item.nextDueDate !== 'string' || !isValidCalendarDate(item.nextDueDate)) {
      return {
        isValid: false,
        error: `Recurring payment "${item.id}" has an invalid nextDueDate: "${item.nextDueDate}".`,
      };
    }
    if (typeof item.isActive !== 'boolean') {
      return { isValid: false, error: `Recurring payment "${item.id}" has an invalid isActive flag.` };
    }
  }

  // Loans
  const loanIdSet = new Set<string>();
  for (let i = 0; i < loans.length; i++) {
    const item = loans[i] as Partial<Loan>;
    if (!item.id || typeof item.id !== 'string') {
      return { isValid: false, error: `Loan at index ${i} has an invalid or missing ID.` };
    }
    if (loanIdSet.has(item.id)) {
      return { isValid: false, error: `Duplicate loan ID detected: "${item.id}".` };
    }
    loanIdSet.add(item.id);

    if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
      return { isValid: false, error: `Loan "${item.id}" has an invalid name.` };
    }
    if (
      typeof item.principalAmountInPaise !== 'number' ||
      !Number.isInteger(item.principalAmountInPaise) ||
      item.principalAmountInPaise <= 0
    ) {
      return { isValid: false, error: `Loan "${item.id}" has invalid principalAmountInPaise.` };
    }
    if (
      typeof item.outstandingAmountInPaise !== 'number' ||
      !Number.isInteger(item.outstandingAmountInPaise) ||
      item.outstandingAmountInPaise < 0
    ) {
      return { isValid: false, error: `Loan "${item.id}" has invalid outstandingAmountInPaise.` };
    }
    if (item.outstandingAmountInPaise > item.principalAmountInPaise) {
      return {
        isValid: false,
        error: `Loan "${item.id}" has outstanding balance exceeding principal amount.`,
      };
    }
    if (
      typeof item.interestRatePercent !== 'number' ||
      item.interestRatePercent < 0 ||
      item.interestRatePercent > 100
    ) {
      return { isValid: false, error: `Loan "${item.id}" has invalid interestRatePercent.` };
    }
    if (
      typeof item.emiAmountInPaise !== 'number' ||
      !Number.isInteger(item.emiAmountInPaise) ||
      item.emiAmountInPaise <= 0
    ) {
      return { isValid: false, error: `Loan "${item.id}" has invalid emiAmountInPaise.` };
    }
    if (
      typeof item.dueDay !== 'number' ||
      !Number.isInteger(item.dueDay) ||
      item.dueDay < 1 ||
      item.dueDay > 31
    ) {
      return { isValid: false, error: `Loan "${item.id}" has invalid dueDay. Must be between 1 and 31.` };
    }
    if (
      typeof item.remainingTenureMonths !== 'number' ||
      !Number.isInteger(item.remainingTenureMonths) ||
      item.remainingTenureMonths < 0
    ) {
      return { isValid: false, error: `Loan "${item.id}" has invalid remainingTenureMonths.` };
    }
    if (!item.startDate || typeof item.startDate !== 'string' || !isValidCalendarDate(item.startDate)) {
      return { isValid: false, error: `Loan "${item.id}" has an invalid startDate: "${item.startDate}".` };
    }
    if (typeof item.isActive !== 'boolean') {
      return { isValid: false, error: `Loan "${item.id}" has an invalid isActive flag.` };
    }
  }

  // Monthly Settings
  const monthlySettingsIdSet = new Set<string>();
  const monthIdSet = new Set<string>();
  for (let i = 0; i < monthlySettings.length; i++) {
    const item = monthlySettings[i] as Partial<MonthlySettings>;
    if (!item.id || typeof item.id !== 'string') {
      return { isValid: false, error: `Monthly settings at index ${i} has an invalid or missing ID.` };
    }
    if (monthlySettingsIdSet.has(item.id)) {
      return { isValid: false, error: `Duplicate monthlySettings ID detected: "${item.id}".` };
    }
    monthlySettingsIdSet.add(item.id);

    if (!item.monthId || typeof item.monthId !== 'string' || !MONTH_ID_REGEX.test(item.monthId)) {
      return {
        isValid: false,
        error: `Monthly settings "${item.id}" has invalid monthId: "${item.monthId}". Must be YYYY-MM.`,
      };
    }
    if (monthIdSet.has(item.monthId)) {
      return { isValid: false, error: `Duplicate monthId detected in monthly settings: "${item.monthId}".` };
    }
    monthIdSet.add(item.monthId);

    if (
      item.incomeInPaise !== null &&
      item.incomeInPaise !== undefined &&
      (typeof item.incomeInPaise !== 'number' ||
        !Number.isInteger(item.incomeInPaise) ||
        item.incomeInPaise < 0)
    ) {
      return { isValid: false, error: `Monthly settings "${item.id}" has invalid incomeInPaise.` };
    }

    if (
      item.budgetInPaise !== null &&
      item.budgetInPaise !== undefined &&
      (typeof item.budgetInPaise !== 'number' ||
        !Number.isInteger(item.budgetInPaise) ||
        item.budgetInPaise < 0)
    ) {
      return { isValid: false, error: `Monthly settings "${item.id}" has invalid budgetInPaise.` };
    }
  }

  return {
    isValid: true,
    counts: {
      expenses: expenses.length,
      categories: categories.length,
      paymentMethods: paymentMethods.length,
      recurringPayments: recurringPayments.length,
      loans: loans.length,
      monthlySettings: monthlySettings.length,
    },
  };
}

/**
 * Exports all 6 core data stores from Dexie into a single versioned backup envelope.
 */
export async function exportBackupData(database: HKFinanceDatabase): Promise<BackupDataEnvelope> {
  const [expenses, categories, paymentMethods, recurringPayments, loans, monthlySettings] =
    await Promise.all([
      database.expenses.toArray(),
      database.categories.toArray(),
      database.paymentMethods.toArray(),
      database.recurringPayments.toArray(),
      database.loans.toArray(),
      database.monthlySettings.toArray(),
    ]);

  return {
    app: 'spendly',
    version: '0.1.0',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      expenses,
      categories,
      paymentMethods,
      recurringPayments,
      loans,
      monthlySettings,
    },
  };
}

/**
 * Triggers a browser download of the backup envelope as a formatted JSON file.
 */
export function downloadBackupFile(envelope: BackupDataEnvelope): void {
  const jsonString = JSON.stringify(envelope, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `spendly-backup-${dateStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Performs an atomic restore of the database from a pre-validated backup envelope.
 * If any error occurs during write, the Dexie transaction automatically rolls back,
 * leaving all existing database records intact.
 */
export async function restoreBackupData(
  database: HKFinanceDatabase,
  envelope: BackupDataEnvelope
): Promise<void> {
  // Pre-flight validation gate
  const validation = validateBackupPayload(envelope);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Backup validation failed.');
  }

  // Atomic transaction spanning all 6 stores
  await database.transaction(
    'rw',
    [
      database.expenses,
      database.categories,
      database.paymentMethods,
      database.recurringPayments,
      database.loans,
      database.monthlySettings,
    ],
    async () => {
      // 1. Clear existing data
      await Promise.all([
        database.expenses.clear(),
        database.categories.clear(),
        database.paymentMethods.clear(),
        database.recurringPayments.clear(),
        database.loans.clear(),
        database.monthlySettings.clear(),
      ]);

      // 2. Repopulate with restored validated records
      await Promise.all([
        envelope.data.expenses.length > 0
          ? database.expenses.bulkAdd(envelope.data.expenses)
          : Promise.resolve(),
        envelope.data.categories.length > 0
          ? database.categories.bulkAdd(envelope.data.categories)
          : Promise.resolve(),
        envelope.data.paymentMethods.length > 0
          ? database.paymentMethods.bulkAdd(envelope.data.paymentMethods)
          : Promise.resolve(),
        envelope.data.recurringPayments.length > 0
          ? database.recurringPayments.bulkAdd(envelope.data.recurringPayments)
          : Promise.resolve(),
        envelope.data.loans.length > 0
          ? database.loans.bulkAdd(envelope.data.loans)
          : Promise.resolve(),
        envelope.data.monthlySettings.length > 0
          ? database.monthlySettings.bulkAdd(envelope.data.monthlySettings)
          : Promise.resolve(),
      ]);
    }
  );
}
