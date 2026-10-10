import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AddExpenseView } from './AddExpenseView';
import { App, SELECTED_MONTH_STORAGE_KEY } from '../App';
import { expenseRepository } from '../repositories/expenseRepository';

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
}));

vi.mock('../repositories/paymentMethodRepository', () => ({
  paymentMethodRepository: {
    ensureDefaults: vi.fn().mockResolvedValue(undefined),
    getActivePaymentMethods: vi.fn().mockResolvedValue([
      { id: 'pm-1', name: 'UPI', isActive: true },
    ]),
    getPaymentMethods: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../repositories/expenseRepository', () => ({
  expenseRepository: {
    getExpensesByMonth: vi.fn().mockResolvedValue([]),
    getExpensesForToday: vi.fn().mockResolvedValue([]),
    addExpense: vi.fn().mockResolvedValue('exp-new-1'),
    updateExpense: vi.fn().mockResolvedValue(undefined),
    deleteExpense: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../repositories/financialSettingsRepository', () => ({
  financialSettingsRepository: {
    getMonthlySettings: vi.fn().mockResolvedValue(null),
    updateMonthlyIncome: vi.fn().mockResolvedValue(undefined),
    updateMonthlyBudget: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../repositories/recurringPaymentRepository', () => ({
  recurringPaymentRepository: {
    getUpcomingPayments: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../repositories/loanRepository', () => ({
  loanRepository: {
    getActiveLoans: vi.fn().mockResolvedValue([]),
  },
}));

describe('BUG-02 & BUG-01 Regression: AddExpenseView & App Save Lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
  });

  it('successful save marks form clean before navigation and calls onExpenseAdded with record', async () => {
    const onDirtyChange = vi.fn();
    const onCancel = vi.fn();
    const onExpenseAdded = vi.fn();

    await act(async () => {
      root.render(
        <AddExpenseView
          onCancel={onCancel}
          onExpenseAdded={onExpenseAdded}
          onDirtyChange={onDirtyChange}
        />
      );
    });

    // Enter amount
    const amountInput = container.querySelector('#expense-amount') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(amountInput, '150');
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      amountInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onDirtyChange).toHaveBeenCalledWith(true);

    // Submit form
    const form = container.querySelector('.add-expense-form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(expenseRepository.addExpense).toHaveBeenCalledTimes(1);
    // Crucial: onDirtyChange(false) called on successful save
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(onExpenseAdded).toHaveBeenCalledWith(
      expect.objectContaining({
        amountInPaise: 15000,
        category: 'Food',
        paymentMethod: 'UPI',
      })
    );
    // onCancel should NOT have been called in addition to onExpenseAdded
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('BUG-02: does not trigger "Discard Unsaved Form?" modal on successful save in App', async () => {
    await act(async () => {
      root.render(<App />);
    });

    // Navigate to Add Expense view
    const addNavBtn = container.querySelector('button[aria-label="Add Expense"]') as HTMLButtonElement;
    await act(async () => {
      addNavBtn.click();
    });

    expect(container.querySelector('.add-expense-form')).not.toBeNull();

    // Fill amount
    const amountInput = container.querySelector('#expense-amount') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(amountInput, '200');
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      amountInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Click "Save Expense"
    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    await act(async () => {
      submitBtn.click();
    });

    // Modal should NEVER appear on successful save!
    expect(container.querySelector('#discard-form-modal-title')).toBeNull();
    // Successfully returned to home
    expect(container.querySelector('.add-expense-form')).toBeNull();
  });

  it('BUG-02: prevents duplicate submissions on rapid double-click', async () => {
    let resolveWrite: (val: any) => void;
    const slowWritePromise = new Promise((resolve) => {
      resolveWrite = resolve;
    });
    vi.mocked(expenseRepository.addExpense).mockImplementationOnce(() => slowWritePromise as Promise<any>);

    const onExpenseAdded = vi.fn();
    await act(async () => {
      root.render(
        <AddExpenseView
          onCancel={vi.fn()}
          onExpenseAdded={onExpenseAdded}
        />
      );
    });

    // Enter amount
    const amountInput = container.querySelector('#expense-amount') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(amountInput, '300');
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      amountInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    // First click initiates save
    await act(async () => {
      submitBtn.click();
    });

    expect(submitBtn.textContent).toBe('Saving...');
    expect(submitBtn.disabled).toBe(true);

    // Second click during in-flight save is blocked
    await act(async () => {
      submitBtn.click();
    });

    expect(expenseRepository.addExpense).toHaveBeenCalledTimes(1);

    // Finish write
    await act(async () => {
      resolveWrite!('exp-slow-1');
    });

    expect(onExpenseAdded).toHaveBeenCalledTimes(1);
  });

  it('BUG-02: handles rejected database writes, terminates loading state, and provides retry', async () => {
    vi.mocked(expenseRepository.addExpense).mockRejectedValueOnce(new Error('IndexedDB quota error'));

    await act(async () => {
      root.render(
        <AddExpenseView
          onCancel={vi.fn()}
          onExpenseAdded={vi.fn()}
        />
      );
    });

    // Enter amount
    const amountInput = container.querySelector('#expense-amount') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(amountInput, '400');
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      amountInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const form = container.querySelector('.add-expense-form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    // Error box displayed
    const errorBox = container.querySelector('.save-error-box');
    expect(errorBox).not.toBeNull();
    expect(errorBox?.textContent).toContain('Unable to save expense');

    // Saving indicator terminated (not stuck in permanent loading)
    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn.textContent).toBe('Save Expense');
    expect(submitBtn.disabled).toBe(false);

    // Retry button exists and functions
    const retryBtn = container.querySelector('.btn-retry-save') as HTMLButtonElement;
    expect(retryBtn).not.toBeNull();

    // Now mock success for retry
    vi.mocked(expenseRepository.addExpense).mockResolvedValueOnce('exp-retry-success');
    await act(async () => {
      retryBtn.click();
    });

    expect(expenseRepository.addExpense).toHaveBeenCalledTimes(2);
  });

  it('BUG-02: guards against navigation while save is in flight', async () => {
    let resolveWrite: (val: any) => void;
    const writePromise = new Promise((resolve) => {
      resolveWrite = resolve;
    });
    vi.mocked(expenseRepository.addExpense).mockImplementationOnce(() => writePromise as Promise<any>);

    const onCancel = vi.fn();
    await act(async () => {
      root.render(
        <AddExpenseView
          onCancel={onCancel}
        />
      );
    });

    // Enter amount
    const amountInput = container.querySelector('#expense-amount') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(amountInput, '500');
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      amountInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    await act(async () => {
      submitBtn.click();
    });

    // Attempt to cancel while saving
    const cancelBtn = container.querySelector('.btn-secondary') as HTMLButtonElement;
    const backBtn = container.querySelector('.btn-icon-back') as HTMLButtonElement;
    expect(cancelBtn.disabled).toBe(true);
    expect(backBtn.disabled).toBe(true);

    await act(async () => {
      cancelBtn.click();
      backBtn.click();
    });

    expect(onCancel).not.toHaveBeenCalled();

    // Finish write
    await act(async () => {
      resolveWrite!('exp-done');
    });
  });

  it('BUG-01: saving an expense in another month updates selectedMonthId in App so records are visible', async () => {
    await act(async () => {
      root.render(<App />);
    });

    // Navigate to Add Expense view
    const addNavBtn = container.querySelector('button[aria-label="Add Expense"]') as HTMLButtonElement;
    await act(async () => {
      addNavBtn.click();
    });

    // Enter amount and change date to September 2026
    const amountInput = container.querySelector('#expense-amount') as HTMLInputElement;
    const dateInput = container.querySelector('#expense-date') as HTMLInputElement;

    await act(async () => {
      const valSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      valSetter?.call(amountInput, '500');
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      amountInput.dispatchEvent(new Event('change', { bubbles: true }));

      valSetter?.call(dateInput, '2026-09-18');
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Save
    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    await act(async () => {
      submitBtn.click();
    });

    // Verifies selected month in storage is updated to 2026-09
    expect(localStorage.getItem(SELECTED_MONTH_STORAGE_KEY)).toBe('2026-09');
  });
});
