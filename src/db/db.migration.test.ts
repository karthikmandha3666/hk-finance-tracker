import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import type { Expense } from '../types';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

describe('IndexedDB schema migrations (v1 through v6) - MAS-16', () => {
  const TEST_DB_NAME = 'test_migration_spendly_db';

  beforeEach(async () => {
    // Ensure clean state before each migration test
    await Dexie.delete(TEST_DB_NAME);
  });

  afterEach(async () => {
    // Clean up after test
    await Dexie.delete(TEST_DB_NAME);
  });

  it('progressively upgrades from v1 through v6 while preserving pre-existing records', async () => {
    // --- Step 1: Start at Version 1 (Expenses only) ---
    const dbV1 = new Dexie(TEST_DB_NAME);
    dbV1.version(1).stores({
      expenses: 'id, date, category, paymentMethod, createdAt, updatedAt',
    });
    await dbV1.open();

    const sampleExpenseV1: Expense = {
      id: 'exp-v1-001',
      amountInPaise: 25050,
      category: 'Food',
      paymentMethod: 'UPI',
      date: '2026-10-01',
      note: 'Legacy v1 expense',
      currency: 'INR',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
    };
    await dbV1.table('expenses').add(sampleExpenseV1);

    expect(await dbV1.table('expenses').count()).toBe(1);
    dbV1.close();

    // --- Step 2: Upgrade to Version 2 (Monthly Settings) ---
    const dbV2 = new Dexie(TEST_DB_NAME);
    dbV2.version(1).stores({
      expenses: 'id, date, category, paymentMethod, createdAt, updatedAt',
    });
    dbV2.version(2).stores({
      monthlySettings: 'id, &monthId, createdAt, updatedAt',
    });
    await dbV2.open();

    // Check v1 data preserved
    const expAfterV2 = await dbV2.table('expenses').get('exp-v1-001');
    expect(expAfterV2).toEqual(sampleExpenseV1);

    // Insert v2 record
    await dbV2.table('monthlySettings').add({
      id: 'sett-v2-001',
      monthId: '2026-10',
      incomeInPaise: 5000000,
      budgetInPaise: 3000000,
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
    });
    expect(await dbV2.table('monthlySettings').count()).toBe(1);
    dbV2.close();

    // --- Step 3: Upgrade to Version 3 (Categories & Payment Methods) ---
    const dbV3 = new Dexie(TEST_DB_NAME);
    dbV3.version(1).stores({
      expenses: 'id, date, category, paymentMethod, createdAt, updatedAt',
    });
    dbV3.version(2).stores({
      monthlySettings: 'id, &monthId, createdAt, updatedAt',
    });
    dbV3.version(3).stores({
      categories: 'id, name, isActive, createdAt, updatedAt',
      paymentMethods: 'id, name, isActive, createdAt, updatedAt',
    });
    await dbV3.open();

    expect(await dbV3.table('expenses').get('exp-v1-001')).toEqual(sampleExpenseV1);
    await dbV3.table('categories').add({ id: 'cat-v3-1', name: 'Food', isActive: true, createdAt: '', updatedAt: '' });
    expect(await dbV3.table('categories').count()).toBe(1);
    dbV3.close();

    // --- Step 4: Upgrade through v6 with all application schemas ---
    const dbV6 = new Dexie(TEST_DB_NAME);
    dbV6.version(1).stores({
      expenses: 'id, date, category, paymentMethod, createdAt, updatedAt',
    });
    dbV6.version(2).stores({
      monthlySettings: 'id, &monthId, createdAt, updatedAt',
    });
    dbV6.version(3).stores({
      categories: 'id, name, isActive, createdAt, updatedAt',
      paymentMethods: 'id, name, isActive, createdAt, updatedAt',
    });
    dbV6.version(4).stores({
      recurringPayments: 'id, name, nextDueDate, frequency, category, paymentMethod, isActive, createdAt, updatedAt',
    });
    dbV6.version(5).stores({
      loans: 'id, name, loanType, dueDay, isActive, createdAt, updatedAt',
    });
    dbV6.version(6).stores({
      dashboardPreferences: 'id, updatedAt',
    });
    await dbV6.open();

    // Verify database is at version 6
    expect(dbV6.verno).toBe(6);

    // Verify all 7 object stores exist
    const tableNames = dbV6.tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([
      'categories',
      'dashboardPreferences',
      'expenses',
      'loans',
      'monthlySettings',
      'paymentMethods',
      'recurringPayments',
    ].sort());

    // Verify original v1 record is still intact
    const originalExpense = await dbV6.table('expenses').get('exp-v1-001');
    expect(originalExpense).toEqual(sampleExpenseV1);

    // Verify v2 record is still intact
    const originalSetting = await dbV6.table('monthlySettings').get('sett-v2-001');
    expect(originalSetting.incomeInPaise).toBe(5000000);

    // Verify v3 record is still intact
    const originalCategory = await dbV6.table('categories').get('cat-v3-1');
    expect(originalCategory.name).toBe('Food');

    // Verify CRUD access on newly added stores in v4, v5, and v6
    // v4: recurringPayments
    await dbV6.table('recurringPayments').add({
      id: 'rec-v4-1',
      name: 'Internet Bill',
      amountInPaise: 99900,
      category: 'Bills',
      paymentMethod: 'UPI',
      frequency: 'Monthly',
      nextDueDate: '2026-10-15',
      isActive: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    });
    expect(await dbV6.table('recurringPayments').get('rec-v4-1')).toBeTruthy();

    // v5: loans
    await dbV6.table('loans').add({
      id: 'loan-v5-1',
      name: 'Car Loan',
      loanType: 'Vehicle',
      dueDay: 5,
      isActive: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    });
    expect(await dbV6.table('loans').get('loan-v5-1')).toBeTruthy();

    // v6: dashboardPreferences
    await dbV6.table('dashboardPreferences').add({
      id: 'default',
      showUpcomingObligations: true,
      showLoansSummary: true,
      updatedAt: '2026-10-01T00:00:00.000Z',
    });
    expect(await dbV6.table('dashboardPreferences').get('default')).toBeTruthy();

    dbV6.close();
  });
});
