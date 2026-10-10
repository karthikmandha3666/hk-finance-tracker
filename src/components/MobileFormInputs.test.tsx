import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AddExpenseView } from './AddExpenseView';
import { ExpensesView } from './ExpensesView';
import { EditFinancialModal } from './EditFinancialModal';
import type { Expense, MonthData } from '../types';

// @ts-expect-error global act flag for react 19
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [],
}));

describe('Mobile Form Inputs & Controls Contract Tests', () => {
  let container: HTMLDivElement;
  let root: Root;

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

  it('renders AddExpenseView controls with form-input classes and proper inputModes', async () => {
    await act(async () => {
      root.render(
        <AddExpenseView
          onExpenseAdded={vi.fn()}
          onCancel={vi.fn()}
          onDirtyChange={vi.fn()}
        />
      );
    });

    const amountInput = container.querySelector('#expense-amount') as HTMLInputElement;
    expect(amountInput).not.toBeNull();
    expect(amountInput.className).toContain('amount-input-hero');
    expect(amountInput.getAttribute('inputmode')).toBe('decimal');

    const dateInput = container.querySelector('#expense-date') as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    expect(dateInput.className).toContain('form-input');

    const noteInput = container.querySelector('#expense-note') as HTMLInputElement;
    expect(noteInput).not.toBeNull();
    expect(noteInput.className).toContain('form-input');
  });

  it('renders ExpensesView filter selects with filter-select class and touch sizing', async () => {
    const mockExpenses: Expense[] = [
      {
        id: 'exp-1',
        amountInPaise: 5000,
        category: 'Food',
        paymentMethod: 'UPI',
        date: '2026-10-05',
        note: 'Test item',
        currency: 'INR',
        createdAt: '2026-10-05T10:00:00.000Z',
        updatedAt: '2026-10-05T10:00:00.000Z',
      },
    ];
    const mockMonths: MonthData[] = [
      { id: '2026-10', label: 'October 2026', shortLabel: 'Oct 2026', isCurrentMonth: true },
    ];

    await act(async () => {
      root.render(
        <ExpensesView
          expenses={mockExpenses}
          months={mockMonths}
          selectedMonthId="2026-10"
          onSelectMonth={vi.fn()}
          onAddExpenseClick={vi.fn()}
          onEditExpense={vi.fn()}
        />
      );
    });

    const categorySelect = container.querySelector('#filter-category-select') as HTMLSelectElement;
    expect(categorySelect).not.toBeNull();
    expect(categorySelect.className).toContain('filter-select');

    const paymentSelect = container.querySelector('#filter-method-select') as HTMLSelectElement;
    expect(paymentSelect).not.toBeNull();
    expect(paymentSelect.className).toContain('filter-select');
  });

  it('renders EditFinancialModal with modal-input for numeric values', async () => {
    await act(async () => {
      root.render(
        <EditFinancialModal
          isOpen={true}
          type="income"
          currentValueInPaise={5000000}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });

    const modalInput = container.querySelector('.modal-input') as HTMLInputElement;
    expect(modalInput).not.toBeNull();
    expect(modalInput.className).toContain('modal-input');
    expect(modalInput.getAttribute('inputmode')).toBe('decimal');
  });
});
