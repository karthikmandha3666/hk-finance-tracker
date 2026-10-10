import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { HKFinanceDatabase } from '../db/db';
import {
  sortCategoriesDeterministic,
  sortCategoryNamesDeterministic,
} from './categoryRepository';
import type { Category } from '../types';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

describe('BUG-04 Regression: Deterministic category ordering across web and mobile views', () => {
  const TEST_DB_NAME = 'test_spendly_category_order_db';
  let testDb: HKFinanceDatabase;

  beforeEach(async () => {
    await Dexie.delete(TEST_DB_NAME);
    testDb = new HKFinanceDatabase();
    (testDb as any).name = TEST_DB_NAME;
    await testDb.open();
  });

  afterEach(async () => {
    testDb.close();
    await Dexie.delete(TEST_DB_NAME);
  });

  it('sortCategoriesDeterministic orders categories alphabetically regardless of insertion order or UUID', () => {
    // Categories inserted in completely arbitrary/reverse order with inverted UUIDs
    const unsortedCategories: Category[] = [
      { id: 'uuid-1', name: 'Travel', isActive: true, createdAt: '2026-10-01', updatedAt: '2026-10-01' },
      { id: 'uuid-2', name: 'Bills', isActive: true, createdAt: '2026-10-02', updatedAt: '2026-10-02' },
      { id: 'uuid-3', name: 'Food', isActive: true, createdAt: '2026-10-03', updatedAt: '2026-10-03' },
      { id: 'uuid-4', name: 'Shopping', isActive: true, createdAt: '2026-10-04', updatedAt: '2026-10-04' },
      { id: 'uuid-5', name: 'Coffee/Snacks', isActive: true, createdAt: '2026-10-05', updatedAt: '2026-10-05' },
    ];

    const sorted = sortCategoriesDeterministic(unsortedCategories);
    const sortedNames = sorted.map((c) => c.name);

    expect(sortedNames).toEqual([
      'Bills',
      'Coffee/Snacks',
      'Food',
      'Shopping',
      'Travel',
    ]);
  });

  it('ensures custom categories appear consistently and identically across mobile and web views', async () => {
    // Seed initial categories
    const categoriesToInsert: Category[] = [
      { id: 'z-id', name: 'Z-Custom Health', isActive: true, createdAt: '2026-10-01', updatedAt: '2026-10-01' },
      { id: 'a-id', name: 'A-Custom Groceries', isActive: true, createdAt: '2026-10-02', updatedAt: '2026-10-02' },
      { id: 'm-id', name: 'M-Custom Fuel', isActive: true, createdAt: '2026-10-03', updatedAt: '2026-10-03' },
      { id: 'b-id', name: 'Bills', isActive: true, createdAt: '2026-10-04', updatedAt: '2026-10-04' },
      { id: 'f-id', name: 'Food', isActive: true, createdAt: '2026-10-05', updatedAt: '2026-10-05' },
    ];

    await testDb.categories.bulkAdd(categoriesToInsert);

    // Retrieve from database and apply deterministic rule
    const fromDb = await testDb.categories.toArray();
    const mobileOrderedCategories = sortCategoriesDeterministic(fromDb.filter((c) => c.isActive));
    const mobileNames = mobileOrderedCategories.map((c) => c.name);

    // Web view extraction rule (ExpensesView filter dropdown)
    const activeFromConfig = mobileOrderedCategories.map((c) => c.name);
    const webOrderedCategories = sortCategoryNamesDeterministic(Array.from(new Set(activeFromConfig)));

    // Both views must produce the exact identical deterministic order
    expect(mobileNames).toEqual(webOrderedCategories);
    expect(mobileNames).toEqual([
      'A-Custom Groceries',
      'Bills',
      'Food',
      'M-Custom Fuel',
      'Z-Custom Health',
    ]);
  });
});
