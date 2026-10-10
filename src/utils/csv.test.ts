import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  escapeCsvField,
  exportExpensesToCsv,
  parseRawCsvLines,
  parseExpensesCsv,
  detectDuplicateExpenses,
  importExpensesToDatabase,
} from './csv';
import { HKFinanceDatabase } from '../db/db';
import type { Expense } from '../types';

describe('Stage 10: CSV Expense Export & Import Utilities', () => {
  let testDb: HKFinanceDatabase;

  beforeEach(async () => {
    testDb = new HKFinanceDatabase();
    await testDb.open();
    await Promise.all([
      testDb.expenses.clear(),
      testDb.categories.clear(),
      testDb.paymentMethods.clear(),
    ]);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  describe('Feature 10.2: CSV Export & Formatting', () => {
    it('escapes CSV fields containing commas, quotes, and newlines per RFC-4180', () => {
      expect(escapeCsvField('Simple')).toBe('Simple');
      expect(escapeCsvField(123)).toBe('123');
      expect(escapeCsvField(null)).toBe('');
      expect(escapeCsvField('Hello, World')).toBe('"Hello, World"');
      expect(escapeCsvField('He said "Hi"')).toBe('"He said ""Hi"""');
      expect(escapeCsvField("Line 1\nLine 2")).toBe("\"Line 1\nLine 2\"");
    });

    it('exports an empty list of expenses to a valid CSV with headers and UTF-8 BOM', () => {
      const csv = exportExpensesToCsv([]);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      const lines = csv.replace('\uFEFF', '').split('\r\n');
      expect(lines.length).toBe(1);
      expect(lines[0]).toBe('Date,Amount (INR),Category,Payment Method,Note');
    });

    it('preserves exact integer paise accuracy and properly formats amounts in rupees', () => {
      const mockExpenses: Expense[] = [
        {
          id: '1',
          amountInPaise: 25050, // ₹250.50
          category: 'Food',
          paymentMethod: 'UPI',
          date: '2026-10-01',
          note: 'Groceries, fruits',
          currency: 'INR',
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
        },
        {
          id: '2',
          amountInPaise: 100000, // ₹1000.00
          category: 'Bills',
          paymentMethod: 'Net Banking',
          date: '2026-10-02',
          note: 'Internet "Fiber" bill',
          currency: 'INR',
          createdAt: '2026-10-02T10:00:00.000Z',
          updatedAt: '2026-10-02T10:00:00.000Z',
        },
      ];

      const csv = exportExpensesToCsv(mockExpenses);
      expect(csv).toContain('2026-10-01,250.50,Food,UPI,"Groceries, fruits"');
      expect(csv).toContain('2026-10-02,1000.00,Bills,Net Banking,"Internet ""Fiber"" bill"');
    });
  });

  describe('Feature 10.3: CSV Parsing & Validation', () => {
    it('parses raw CSV text with quoted fields and embedded commas', () => {
      const text = 'Date,Amount,Category\n2026-10-01,100.50,"Food, Dining"\n2026-10-02,50.00,Transport';
      const rows = parseRawCsvLines(text);
      expect(rows.length).toBe(3);
      expect(rows[1][2]).toBe('Food, Dining');
    });

    it('parses valid expense CSV and recognizes flexible column header aliases', () => {
      const csv = `Date,Amount (INR),Category,Payment Method,Note
2026-10-05,500.00,Entertainment,Credit Card,Movie night
2026-10-06,12.50,Snacks,Cash,Tea`;

      const result = parseExpensesCsv(csv);
      expect(result.errors.length).toBe(0);
      expect(result.validRows.length).toBe(2);
      expect(result.validRows[0].amountInPaise).toBe(50000);
      expect(result.validRows[0].category).toBe('Entertainment');
      expect(result.validRows[1].amountInPaise).toBe(1250);
    });

    it('rejects empty CSV and files missing required columns', () => {
      expect(parseExpensesCsv('').errors[0].reason).toContain('empty');

      const missingCols = 'Date,Amount\n2026-10-01,100';
      const res = parseExpensesCsv(missingCols);
      expect(res.errors.length).toBe(1);
      expect(res.errors[0].reason).toContain('Missing required column headers');
    });

    it('flags invalid dates, non-numeric amounts, and missing values with specific row numbers', () => {
      const csv = `Date,Amount,Category,Payment Method,Note
invalid-date,100,Food,Cash,Row 2
2026-10-05,-50,Food,Cash,Row 3
2026-10-06,abc,Food,Cash,Row 4
2026-10-07,150,,Cash,Row 5
2026-10-08,200,Food,,Row 6
2026-10-09,50.25,Food,UPI,Valid Row 7`;

      const result = parseExpensesCsv(csv);
      expect(result.validRows.length).toBe(1);
      expect(result.validRows[0].rowNumber).toBe(7);
      expect(result.errors.length).toBe(5);

      expect(result.errors[0].rowNumber).toBe(2);
      expect(result.errors[0].reason).toContain('Invalid date format');

      expect(result.errors[1].rowNumber).toBe(3);
      expect(result.errors[1].reason).toContain('positive number');

      expect(result.errors[2].rowNumber).toBe(4);
      expect(result.errors[2].reason).toContain('Invalid amount');

      expect(result.errors[3].rowNumber).toBe(5);
      expect(result.errors[3].reason).toContain('Category cannot be empty');

      expect(result.errors[4].rowNumber).toBe(6);
      expect(result.errors[4].reason).toContain('Payment Method cannot be empty');
    });
  });

  describe('Duplicate Detection & Atomic Import', () => {
    it('detects duplicate expenses matching existing database records', () => {
      const existing: Expense[] = [
        {
          id: 'exp-1',
          amountInPaise: 45000,
          category: 'Shopping',
          paymentMethod: 'UPI',
          date: '2026-10-01',
          note: 'Shoes',
          currency: 'INR',
          createdAt: '2026-10-01T12:00:00.000Z',
          updatedAt: '2026-10-01T12:00:00.000Z',
        },
      ];

      const toImport = [
        {
          rowNumber: 2,
          date: '2026-10-01',
          amountInPaise: 45000,
          category: 'Shopping',
          paymentMethod: 'UPI',
          note: 'Shoes',
        },
        {
          rowNumber: 3,
          date: '2026-10-02',
          amountInPaise: 15000,
          category: 'Coffee',
          paymentMethod: 'Cash',
          note: 'Morning espresso',
        },
      ];

      const { uniqueRows, duplicateRows } = detectDuplicateExpenses(toImport, existing);
      expect(duplicateRows.length).toBe(1);
      expect(duplicateRows[0].rowNumber).toBe(2);
      expect(uniqueRows.length).toBe(1);
      expect(uniqueRows[0].rowNumber).toBe(3);
    });

    it('atomically imports valid expenses and automatically registers unseen categories and payment methods', async () => {
      const toImport = [
        {
          rowNumber: 2,
          date: '2026-10-10',
          amountInPaise: 75000,
          category: 'Gym Membership',
          paymentMethod: 'Google Pay',
          note: 'Monthly subscription',
        },
      ];

      const res = await importExpensesToDatabase(toImport, testDb);
      expect(res.importedCount).toBe(1);

      // Verify expense record
      const expenses = await testDb.expenses.toArray();
      expect(expenses.length).toBe(1);
      expect(expenses[0].amountInPaise).toBe(75000);
      expect(expenses[0].category).toBe('Gym Membership');
      expect(expenses[0].currency).toBe('INR');

      // Verify category was registered
      const categories = await testDb.categories.toArray();
      const gymCat = categories.find((c) => c.name.toLowerCase() === 'gym membership');
      expect(gymCat).toBeDefined();
      expect(gymCat?.isActive).toBe(true);

      // Verify payment method was registered
      const methods = await testDb.paymentMethods.toArray();
      const gpayMethod = methods.find((m) => m.name.toLowerCase() === 'google pay');
      expect(gpayMethod).toBeDefined();
      expect(gpayMethod?.isActive).toBe(true);
    });
  });
});
