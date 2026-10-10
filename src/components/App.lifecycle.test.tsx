import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from '../App';
import { expenseRepository } from '../repositories/expenseRepository';

// @ts-expect-error global act flag for react 19
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [],
}));

vi.mock('../repositories/categoryRepository', () => ({
  categoryRepository: {
    ensureDefaults: vi.fn().mockResolvedValue(undefined),
    getActiveCategories: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockResolvedValue([]),
  },
  sortCategoriesDeterministic: (cats: any[]) => cats,
  sortCategoryNamesDeterministic: (names: any[]) => names,
}));

vi.mock('../repositories/paymentMethodRepository', () => ({
  paymentMethodRepository: {
    ensureDefaults: vi.fn().mockResolvedValue(undefined),
    getActivePaymentMethods: vi.fn().mockResolvedValue([]),
    getPaymentMethods: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../repositories/expenseRepository', () => ({
  expenseRepository: {
    getExpensesByMonth: vi.fn().mockResolvedValue([]),
    getExpensesForToday: vi.fn().mockResolvedValue([]),
    addExpense: vi.fn().mockResolvedValue({ id: 'exp-1' }),
    updateExpense: vi.fn().mockResolvedValue({ id: 'exp-1' }),
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

describe('App Lifecycle: MAS-04, MAS-10, MAS-11', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('MAS-10: displays accessible PWA update banner upon spendly-pwa-update event', async () => {
    await act(async () => {
      root.render(<App />);
    });

    // Initially no update banner
    expect(container.querySelector('.pwa-update-banner')).toBeNull();

    // Dispatch update event
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('spendly-pwa-update', {
          detail: { updateSW: vi.fn() },
        })
      );
    });

    // Update banner is displayed
    const banner = container.querySelector('.pwa-update-banner');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Update available!');
    expect(banner?.getAttribute('role')).toBe('alert');

    // Dismiss banner
    const dismissBtn = container.querySelector('.btn-pwa-dismiss') as HTMLButtonElement;
    await act(async () => {
      dismissBtn.click();
    });
    expect(container.querySelector('.pwa-update-banner')).toBeNull();
  });

  it('MAS-04: prompts user with discard modal when switching tabs with unsaved form input', async () => {
    await act(async () => {
      root.render(<App />);
    });

    // Navigate to Add Expense view
    const bottomNavAddBtn = container.querySelector('button[aria-label="Add Expense"]') as HTMLButtonElement;
    await act(async () => {
      bottomNavAddBtn.click();
    });

    // Verify Add Expense form is rendered
    expect(container.querySelector('.add-expense-form')).not.toBeNull();

    // Enter an amount to dirty the form
    const amountInput = container.querySelector('#expense-amount') as HTMLInputElement;
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(amountInput, '250');
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      amountInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Attempt to switch to Expenses tab while form is dirty
    const expensesTabBtn = container.querySelector('button[aria-label="Expenses"]') as HTMLButtonElement;
    await act(async () => {
      expensesTabBtn.click();
    });

    // Discard modal should appear, preventing silent destruction
    const modal = container.querySelector('.modal-card');
    expect(modal).not.toBeNull();
    expect(modal?.textContent).toContain('Discard Unsaved Form?');

    // Click "Keep Editing" -> cancels discard, preserves form
    const keepEditingBtn = container.querySelector('.btn-modal-cancel') as HTMLButtonElement;
    await act(async () => {
      keepEditingBtn.click();
    });
    expect(container.querySelector('#discard-form-modal-title')).toBeNull();
    expect(container.querySelector('.add-expense-form')).not.toBeNull();

    // Now click tab again and confirm "Discard"
    await act(async () => {
      expensesTabBtn.click();
    });
    const discardBtn = container.querySelector('.btn-modal-delete') as HTMLButtonElement;
    await act(async () => {
      discardBtn.click();
    });

    // Discard modal closed and successfully navigated to Expenses
    expect(container.querySelector('#discard-form-modal-title')).toBeNull();
    expect(container.querySelector('.add-expense-form')).toBeNull();
  });

  it('MAS-11: passes updated expense with new date when edited across month boundary', async () => {
    const { EditExpenseView } = await import('./EditExpenseView');
    const onUpdated = vi.fn();
    const onCancel = vi.fn();

    const sampleExpense = {
      id: 'exp-oct-1',
      amountInPaise: 50000,
      category: 'Food',
      paymentMethod: 'UPI',
      date: '2026-10-15',
      note: 'Dinner',
      currency: 'INR' as const,
      createdAt: '2026-10-15T12:00:00.000Z',
      updatedAt: '2026-10-15T12:00:00.000Z',
    };

    await act(async () => {
      root.render(
        <EditExpenseView
          expense={sampleExpense}
          onCancel={onCancel}
          onExpenseUpdated={onUpdated}
        />
      );
    });

    // Change date to September
    const dateInput = container.querySelector('#expense-date') as HTMLInputElement;
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(dateInput, '2026-09-20');
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Submit form
    const form = container.querySelector('.add-expense-form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(expenseRepository.updateExpense).toHaveBeenCalled();
    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'exp-oct-1',
        date: '2026-09-20',
      })
    );
  });
});
