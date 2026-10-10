import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AddExpenseView } from './AddExpenseView';
import { EditExpenseView } from './EditExpenseView';
import type { Expense } from '../types';

// @ts-expect-error global act flag for react 19
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (queryFn: any) => {
    const fnStr = queryFn.toString();
    if (fnStr.includes('categoryRepository')) {
      return [
        { id: 'cat-1', name: 'Food', isActive: true },
        { id: 'cat-2', name: 'Travel', isActive: true },
      ];
    }
    if (fnStr.includes('paymentMethodRepository')) {
      return [
        { id: 'pm-1', name: 'UPI', isActive: true },
        { id: 'pm-2', name: 'Cash', isActive: true },
      ];
    }
    return [];
  },
}));

vi.mock('../repositories/categoryRepository', () => ({
  categoryRepository: {
    ensureDefaults: vi.fn().mockResolvedValue(undefined),
    getActiveCategories: vi.fn().mockResolvedValue([
      { id: 'cat-1', name: 'Food', isActive: true },
      { id: 'cat-2', name: 'Travel', isActive: true },
    ]),
    getCategories: vi.fn().mockResolvedValue([]),
  },
  sortCategoriesDeterministic: (cats: any[]) => cats,
  sortCategoryNamesDeterministic: (names: any[]) => names,
}));

vi.mock('../repositories/paymentMethodRepository', () => ({
  paymentMethodRepository: {
    ensureDefaults: vi.fn().mockResolvedValue(undefined),
    getActivePaymentMethods: vi.fn().mockResolvedValue([
      { id: 'pm-1', name: 'UPI', isActive: true },
      { id: 'pm-2', name: 'Cash', isActive: true },
    ]),
    getPaymentMethods: vi.fn().mockResolvedValue([]),
  },
}));

describe('BUG-03 Regression: Form consistency between Add and Edit views', () => {
  let container: HTMLDivElement;
  let root: Root;

  const sampleExpense: Expense = {
    id: 'exp-test-1',
    amountInPaise: 25000,
    category: 'Food',
    paymentMethod: 'UPI',
    date: '2026-10-10',
    note: 'Initial note',
    currency: 'INR',
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('verifies AddExpenseView renders the canonical set of 5 expense fields with exact labels', async () => {
    await act(async () => {
      root.render(
        <AddExpenseView
          onCancel={vi.fn()}
        />
      );
    });

    // 1. Amount input card and label
    const amountLabel = container.querySelector('label[for="expense-amount"]');
    expect(amountLabel).not.toBeNull();
    expect(amountLabel?.textContent).toBe('Amount');
    expect(container.querySelector('#expense-amount')).not.toBeNull();

    // 2. Category section
    const categoryGroup = container.querySelectorAll('.form-group')[0];
    expect(categoryGroup.querySelector('.form-label')?.textContent).toBe('Category');
    expect(categoryGroup.querySelector('.category-chips-grid')).not.toBeNull();

    // 3. Date field
    const dateLabel = container.querySelector('label[for="expense-date"]');
    expect(dateLabel).not.toBeNull();
    expect(dateLabel?.textContent).toBe('Date');
    expect(container.querySelector('#expense-date')).not.toBeNull();

    // 4. Payment Method section
    const paymentGroup = container.querySelectorAll('.form-group')[2];
    expect(paymentGroup.querySelector('.form-label')?.textContent).toBe('Payment Method');
    expect(paymentGroup.querySelector('.payment-chips-grid')).not.toBeNull();

    // 5. Note field
    const noteLabel = container.querySelector('label[for="expense-note"]');
    expect(noteLabel).not.toBeNull();
    expect(noteLabel?.textContent).toContain('Optional Note');
    expect(container.querySelector('#expense-note')).not.toBeNull();

    // Action buttons
    expect(container.querySelector('.btn-secondary')?.textContent).toBe('Cancel');
    expect(container.querySelector('.btn-primary')?.textContent).toBe('Save Expense');
  });

  it('verifies EditExpenseView renders the canonical set of 5 expense fields with exact matching labels', async () => {
    await act(async () => {
      root.render(
        <EditExpenseView
          expense={sampleExpense}
          onCancel={vi.fn()}
        />
      );
    });

    // 1. Amount input card and label
    const amountLabel = container.querySelector('label[for="expense-amount"]');
    expect(amountLabel).not.toBeNull();
    expect(amountLabel?.textContent).toBe('Amount');
    expect(container.querySelector('#expense-amount')).not.toBeNull();

    // 2. Category section
    const categoryGroup = container.querySelectorAll('.form-group')[0];
    expect(categoryGroup.querySelector('.form-label')?.textContent).toBe('Category');
    expect(categoryGroup.querySelector('.category-chips-grid')).not.toBeNull();

    // 3. Date field
    const dateLabel = container.querySelector('label[for="expense-date"]');
    expect(dateLabel).not.toBeNull();
    expect(dateLabel?.textContent).toBe('Date');
    expect(container.querySelector('#expense-date')).not.toBeNull();

    // 4. Payment Method section
    const paymentGroup = container.querySelectorAll('.form-group')[2];
    expect(paymentGroup.querySelector('.form-label')?.textContent).toBe('Payment Method');
    expect(paymentGroup.querySelector('.payment-chips-grid')).not.toBeNull();

    // 5. Note field
    const noteLabel = container.querySelector('label[for="expense-note"]');
    expect(noteLabel).not.toBeNull();
    expect(noteLabel?.textContent).toContain('Optional Note');
    expect(container.querySelector('#expense-note')).not.toBeNull();

    // Action buttons
    expect(container.querySelector('.btn-secondary')?.textContent).toBe('Cancel');
    expect(container.querySelector('.btn-primary')?.textContent).toBe('Save Changes');
    expect(container.querySelector('.btn-danger-outline')?.textContent).toContain('Delete Expense');
  });
});
