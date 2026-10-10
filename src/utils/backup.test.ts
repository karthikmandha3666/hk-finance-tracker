import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { HKFinanceDatabase } from '../db/db';
import {
  validateBackupPayload,
  exportBackupData,
  restoreBackupData,
  BackupDataEnvelope,
} from './backup';

describe('MAS-18: Backup and Restore Engine', () => {
  let testDb: HKFinanceDatabase;

  const validSampleBackup: BackupDataEnvelope = {
    app: 'spendly',
    version: '0.1.0',
    formatVersion: 1,
    exportedAt: '2026-10-10T12:00:00.000Z',
    data: {
      expenses: [
        {
          id: 'exp-1',
          amountInPaise: 45000,
          category: 'Groceries',
          paymentMethod: 'UPI',
          date: '2026-10-05',
          note: 'Supermarket purchase',
          currency: 'INR',
          createdAt: '2026-10-05T10:00:00.000Z',
          updatedAt: '2026-10-05T10:00:00.000Z',
        },
      ],
      categories: [
        {
          id: 'cat-1',
          name: 'Groceries',
          isActive: true,
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      paymentMethods: [
        {
          id: 'pm-1',
          name: 'UPI',
          isActive: true,
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      recurringPayments: [
        {
          id: 'rec-1',
          name: 'Internet Fiber',
          amountInPaise: 99900,
          category: 'Utilities',
          paymentMethod: 'Net Banking',
          frequency: 'Monthly',
          nextDueDate: '2026-10-25',
          anchorDay: 25,
          isActive: true,
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      loans: [
        {
          id: 'loan-1',
          name: 'Car Loan',
          loanType: 'Car Loan',
          principalAmountInPaise: 50000000,
          outstandingAmountInPaise: 42000000,
          interestRatePercent: 8.5,
          emiAmountInPaise: 1250000,
          dueDay: 10,
          remainingTenureMonths: 36,
          startDate: '2025-05-10',
          isActive: true,
          createdAt: '2025-05-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      monthlySettings: [
        {
          id: 'ms-1',
          monthId: '2026-10',
          incomeInPaise: 15000000,
          budgetInPaise: 8000000,
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    },
  };

  beforeEach(async () => {
    // Generate fresh isolated in-memory IndexedDB per test
    testDb = new HKFinanceDatabase();
    await testDb.open();
    await Promise.all([
      testDb.expenses.clear(),
      testDb.categories.clear(),
      testDb.paymentMethods.clear(),
      testDb.recurringPayments.clear(),
      testDb.loans.clear(),
      testDb.monthlySettings.clear(),
    ]);
  });

  describe('Pre-flight Schema Validation', () => {
    it('accepts a fully compliant backup envelope and returns correct entity counts', () => {
      const res = validateBackupPayload(validSampleBackup);
      expect(res.isValid).toBe(true);
      expect(res.counts).toEqual({
        expenses: 1,
        categories: 1,
        paymentMethods: 1,
        recurringPayments: 1,
        loans: 1,
        monthlySettings: 1,
      });
    });

    it('rejects payloads with invalid app signature', () => {
      const invalid = { ...validSampleBackup, app: 'other_app' };
      const res = validateBackupPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Expected "spendly"');
    });

    it('rejects unsupported format versions', () => {
      const invalid = { ...validSampleBackup, formatVersion: 2 };
      const res = validateBackupPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Unsupported backup format version');
    });

    it('rejects malformed non-object inputs', () => {
      expect(validateBackupPayload(null).isValid).toBe(false);
      expect(validateBackupPayload([]).isValid).toBe(false);
      expect(validateBackupPayload('string').isValid).toBe(false);
    });

    it('rejects payloads with missing store containers', () => {
      const invalid = {
        ...validSampleBackup,
        data: { ...validSampleBackup.data, expenses: undefined as any },
      };
      const res = validateBackupPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('The "expenses" store must be an array');
    });

    it('rejects duplicate IDs within any entity collection', () => {
      const invalid = {
        ...validSampleBackup,
        data: {
          ...validSampleBackup.data,
          expenses: [
            validSampleBackup.data.expenses[0],
            { ...validSampleBackup.data.expenses[0], amountInPaise: 99000 },
          ],
        },
      };
      const res = validateBackupPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Duplicate expense ID detected: "exp-1"');
    });

    it('rejects negative or floating-point currency amounts in expenses', () => {
      const invalid = {
        ...validSampleBackup,
        data: {
          ...validSampleBackup.data,
          expenses: [
            {
              ...validSampleBackup.data.expenses[0],
              amountInPaise: -500,
            },
          ],
        },
      };
      const res = validateBackupPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Must be a positive integer');
    });

    it('rejects invalid or impossible calendar dates', () => {
      const invalid = {
        ...validSampleBackup,
        data: {
          ...validSampleBackup.data,
          expenses: [
            {
              ...validSampleBackup.data.expenses[0],
              date: '2026-02-31', // Impossible calendar date
            },
          ],
        },
      };
      const res = validateBackupPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('invalid date: "2026-02-31"');
    });

    it('rejects invalid recurring frequencies', () => {
      const invalid = {
        ...validSampleBackup,
        data: {
          ...validSampleBackup.data,
          recurringPayments: [
            {
              ...validSampleBackup.data.recurringPayments[0],
              frequency: 'BiWeekly' as any,
            },
          ],
        },
      };
      const res = validateBackupPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('invalid frequency: "BiWeekly"');
    });

    it('rejects loans with outstanding balance exceeding principal', () => {
      const invalid = {
        ...validSampleBackup,
        data: {
          ...validSampleBackup.data,
          loans: [
            {
              ...validSampleBackup.data.loans[0],
              principalAmountInPaise: 10000,
              outstandingAmountInPaise: 20000,
            },
          ],
        },
      };
      const res = validateBackupPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('outstanding balance exceeding principal');
    });

    it('rejects duplicate monthId in monthlySettings', () => {
      const invalid = {
        ...validSampleBackup,
        data: {
          ...validSampleBackup.data,
          monthlySettings: [
            validSampleBackup.data.monthlySettings[0],
            {
              id: 'ms-2',
              monthId: '2026-10', // duplicate monthId
              incomeInPaise: 1000,
              budgetInPaise: 1000,
              createdAt: '2026-10-01T00:00:00.000Z',
              updatedAt: '2026-10-01T00:00:00.000Z',
            },
          ],
        },
      };
      const res = validateBackupPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Duplicate monthId detected');
    });
  });

  describe('Database Export & Atomic Restore Lifecycle', () => {
    it('exports all 6 stores accurately into the versioned envelope', async () => {
      await testDb.categories.add({
        id: 'cat-test',
        name: 'Health',
        isActive: true,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      });
      await testDb.expenses.add({
        id: 'exp-test',
        amountInPaise: 12000,
        category: 'Health',
        paymentMethod: 'Cash',
        date: '2026-10-08',
        note: 'Pharmacy',
        currency: 'INR',
        createdAt: '2026-10-08T00:00:00.000Z',
        updatedAt: '2026-10-08T00:00:00.000Z',
      });

      const exported = await exportBackupData(testDb);
      expect(exported.app).toBe('spendly');
      expect(exported.formatVersion).toBe(1);
      expect(exported.data.categories).toHaveLength(1);
      expect(exported.data.categories[0].name).toBe('Health');
      expect(exported.data.expenses).toHaveLength(1);
      expect(exported.data.expenses[0].amountInPaise).toBe(12000);
      expect(exported.data.loans).toHaveLength(0);
    });

    it('successfully restores all stores atomically from a valid backup', async () => {
      // Seed pre-existing initial data
      await testDb.expenses.add({
        id: 'old-exp',
        amountInPaise: 1000,
        category: 'Misc',
        paymentMethod: 'Cash',
        date: '2026-10-01',
        note: 'Old',
        currency: 'INR',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      });

      await restoreBackupData(testDb, validSampleBackup);

      const allExpenses = await testDb.expenses.toArray();
      const allCategories = await testDb.categories.toArray();
      const allPayments = await testDb.recurringPayments.toArray();
      const allLoans = await testDb.loans.toArray();

      expect(allExpenses).toHaveLength(1);
      expect(allExpenses[0].id).toBe('exp-1');
      expect(allExpenses[0].amountInPaise).toBe(45000);
      expect(allCategories[0].name).toBe('Groceries');
      expect(allPayments[0].name).toBe('Internet Fiber');
      expect(allLoans[0].name).toBe('Car Loan');
    });

    it('preserves existing data completely when restore is rejected before writing', async () => {
      // Seed initial data
      await testDb.expenses.add({
        id: 'initial-exp',
        amountInPaise: 55500,
        category: 'Shopping',
        paymentMethod: 'Card',
        date: '2026-10-02',
        note: 'Preserved record',
        currency: 'INR',
        createdAt: '2026-10-02T00:00:00.000Z',
        updatedAt: '2026-10-02T00:00:00.000Z',
      });

      const malformedPayload = {
        ...validSampleBackup,
        data: {
          ...validSampleBackup.data,
          expenses: [{ ...validSampleBackup.data.expenses[0], amountInPaise: -999 }],
        },
      };

      await expect(restoreBackupData(testDb, malformedPayload)).rejects.toThrow(
        'Must be a positive integer'
      );

      // Verify initial data remains intact
      const preservedExpenses = await testDb.expenses.toArray();
      expect(preservedExpenses).toHaveLength(1);
      expect(preservedExpenses[0].id).toBe('initial-exp');
      expect(preservedExpenses[0].amountInPaise).toBe(55500);
    });

    it('rolls back complete transaction and preserves existing records if database write fails', async () => {
      // Seed pre-existing records
      await testDb.expenses.add({
        id: 'safety-exp-1',
        amountInPaise: 12500,
        category: 'Food',
        paymentMethod: 'UPI',
        date: '2026-10-01',
        note: 'Existing record before failed restore',
        currency: 'INR',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      });

      // Spy on bulkAdd on loans to simulate a catastrophic storage write failure
      const originalBulkAdd = testDb.loans.bulkAdd;
      testDb.loans.bulkAdd = (() => {
        throw new Error('Simulated disk/IndexedDB transaction write failure');
      }) as any;

      try {
        await expect(restoreBackupData(testDb, validSampleBackup)).rejects.toThrow(
          'Simulated disk/IndexedDB transaction write failure'
        );

        // Verify that Dexie atomic transaction rolled back: original records must still be present!
        const expensesAfterFailure = await testDb.expenses.toArray();
        expect(expensesAfterFailure).toHaveLength(1);
        expect(expensesAfterFailure[0].id).toBe('safety-exp-1');
        expect(expensesAfterFailure[0].amountInPaise).toBe(12500);
      } finally {
        testDb.loans.bulkAdd = originalBulkAdd;
      }
    });

    it('allows normal application use and mutations immediately after a successful restore', async () => {
      await restoreBackupData(testDb, validSampleBackup);

      // Normal application usage: adding a new expense
      await testDb.expenses.add({
        id: 'new-exp-post-restore',
        amountInPaise: 88000,
        category: 'Groceries',
        paymentMethod: 'UPI',
        date: '2026-10-09',
        note: 'Fresh transaction after restore',
        currency: 'INR',
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      });

      const expenses = await testDb.expenses.toArray();
      expect(expenses).toHaveLength(2);
      expect(expenses.some((e) => e.id === 'new-exp-post-restore')).toBe(true);
      expect(expenses.some((e) => e.id === 'exp-1')).toBe(true);
    });
  });
});
