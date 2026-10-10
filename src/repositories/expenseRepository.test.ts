import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { HKFinanceDatabase } from '../db/db';
import type { Expense } from '../types';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

describe('BUG-01 Regression: expense persistence and multi-month retrieval across reload', () => {
  const TEST_DB_NAME = 'test_spendly_expense_db';
  let testDb: HKFinanceDatabase;

  beforeEach(async () => {
    await Dexie.delete(TEST_DB_NAME);
    testDb = new HKFinanceDatabase();
    // Override db name for test isolation
    (testDb as any).name = TEST_DB_NAME;
    await testDb.open();
  });

  afterEach(async () => {
    testDb.close();
    await Dexie.delete(TEST_DB_NAME);
  });

  it('creates, saves, simulates page reload, and retrieves records across multiple months', async () => {
    // 1. Create expenses across multiple months
    const expenseOct: Expense = {
      id: 'exp-oct-1',
      amountInPaise: 25000,
      category: 'Food',
      paymentMethod: 'UPI',
      date: '2026-10-10',
      note: 'Lunch at Cafe',
      currency: 'INR',
      createdAt: '2026-10-10T12:00:00.000Z',
      updatedAt: '2026-10-10T12:00:00.000Z',
    };

    const expenseSep: Expense = {
      id: 'exp-sep-1',
      amountInPaise: 150000,
      category: 'Rent',
      paymentMethod: 'Net Banking',
      date: '2026-09-01',
      note: 'September House Rent',
      currency: 'INR',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    };

    const expenseNov: Expense = {
      id: 'exp-nov-1',
      amountInPaise: 49900,
      category: 'Subscription',
      paymentMethod: 'Credit Card',
      date: '2026-11-15',
      note: 'Annual Cloud Storage',
      currency: 'INR',
      createdAt: '2026-11-15T08:00:00.000Z',
      updatedAt: '2026-11-15T08:00:00.000Z',
    };

    // 2. Persist to database ensuring writes complete
    await testDb.expenses.add(expenseOct);
    await testDb.expenses.add(expenseSep);
    await testDb.expenses.add(expenseNov);

    // 3. Simulate browser refresh / page reload: close database instance and open fresh connection
    testDb.close();

    const reloadedDb = new HKFinanceDatabase();
    (reloadedDb as any).name = TEST_DB_NAME;
    await reloadedDb.open();

    // 4. Verify that records exist in IndexedDB after refresh and can be retrieved by month
    const octExpenses = await reloadedDb.expenses
      .where('date')
      .startsWith('2026-10')
      .toArray();
    expect(octExpenses).toHaveLength(1);
    expect(octExpenses[0].id).toBe('exp-oct-1');
    expect(octExpenses[0].amountInPaise).toBe(25000);

    const sepExpenses = await reloadedDb.expenses
      .where('date')
      .startsWith('2026-09')
      .toArray();
    expect(sepExpenses).toHaveLength(1);
    expect(sepExpenses[0].id).toBe('exp-sep-1');
    expect(sepExpenses[0].category).toBe('Rent');

    const novExpenses = await reloadedDb.expenses
      .where('date')
      .startsWith('2026-11')
      .toArray();
    expect(novExpenses).toHaveLength(1);
    expect(novExpenses[0].id).toBe('exp-nov-1');
    expect(novExpenses[0].amountInPaise).toBe(49900);

    // 5. Total count after reload matches all saved records
    const allCount = await reloadedDb.expenses.count();
    expect(allCount).toBe(3);

    reloadedDb.close();
  });
});
