import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ExpensesView } from './ExpensesView';
import { expenseRepository } from '../repositories/expenseRepository';
import type { Expense, MonthData } from '../types';

// Configure React act environment for testing
// @ts-expect-error global act flag for react 19
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock dexie-react-hooks so live queries return static active lists without DB initialization
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [],
}));

// Mock expenseRepository
vi.mock('../repositories/expenseRepository', () => ({
  expenseRepository: {
    deleteExpense: vi.fn(),
  },
}));

describe('ExpensesView delete confirmation behavior', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockMonths: MonthData[] = [
    { id: '2026-10', label: 'October 2026', shortLabel: 'Oct 2026', isCurrentMonth: true },
  ];

  const sampleExpense: Expense = {
    id: 'exp-123',
    amountInPaise: 45000, // ₹450
    category: 'Food',
    paymentMethod: 'UPI',
    date: '2026-10-09',
    note: 'Team lunch',
    currency: 'INR',
    createdAt: '2026-10-09T10:00:00.000Z',
    updatedAt: '2026-10-09T10:00:00.000Z',
  };

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

  const renderComponent = async (expenses: Expense[] = [sampleExpense]) => {
    await act(async () => {
      root.render(
        <ExpensesView
          months={mockMonths}
          selectedMonthId="2026-10"
          onSelectMonth={vi.fn()}
          expenses={expenses}
          onAddExpenseClick={vi.fn()}
          onEditExpense={vi.fn()}
        />
      );
    });
  };

  it('renders expense list without open confirmation modal initially', async () => {
    await renderComponent();

    // Verify expense item exists
    const expenseItem = container.querySelector('.expense-ledger-item');
    expect(expenseItem).not.toBeNull();

    // Verify delete confirmation modal is NOT rendered initially
    const backdrop = container.querySelector('.modal-backdrop');
    expect(backdrop).toBeNull();
  });

  it('opens confirmation modal with expense details when delete button is clicked', async () => {
    await renderComponent();

    // Click delete action button
    const deleteBtn = container.querySelector('.btn-ledger-action.delete') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn.click();
    });

    // Confirmation modal should now be visible
    const backdrop = container.querySelector('.modal-backdrop');
    expect(backdrop).not.toBeNull();

    const title = container.querySelector('.modal-title');
    expect(title?.textContent).toBe('Delete Expense?');

    const desc = container.querySelector('.modal-desc');
    expect(desc?.textContent).toContain('₹450');
    expect(desc?.textContent).toContain('Food');
    expect(desc?.textContent).toContain('2026-10-09');
  });

  it('preserves the record and closes modal when Cancel is clicked', async () => {
    await renderComponent();

    // Open modal
    const deleteBtn = container.querySelector('.btn-ledger-action.delete') as HTMLButtonElement;
    await act(async () => {
      deleteBtn.click();
    });

    expect(container.querySelector('.modal-backdrop')).not.toBeNull();

    // Click Cancel
    const cancelBtn = container.querySelector('.btn-modal-cancel') as HTMLButtonElement;
    expect(cancelBtn).not.toBeNull();

    await act(async () => {
      cancelBtn.click();
    });

    // Modal should be closed
    expect(container.querySelector('.modal-backdrop')).toBeNull();

    // expenseRepository.deleteExpense should NOT have been called
    expect(expenseRepository.deleteExpense).not.toHaveBeenCalled();
  });

  it('calls expenseRepository.deleteExpense with the target ID when Confirm is clicked', async () => {
    vi.mocked(expenseRepository.deleteExpense).mockResolvedValueOnce();

    await renderComponent();

    // Open modal
    const deleteBtn = container.querySelector('.btn-ledger-action.delete') as HTMLButtonElement;
    await act(async () => {
      deleteBtn.click();
    });

    // Click Yes, Delete
    const confirmBtn = container.querySelector('.btn-modal-delete') as HTMLButtonElement;
    expect(confirmBtn).not.toBeNull();

    await act(async () => {
      confirmBtn.click();
    });

    // Verify repository call
    expect(expenseRepository.deleteExpense).toHaveBeenCalledTimes(1);
    expect(expenseRepository.deleteExpense).toHaveBeenCalledWith('exp-123');

    // Modal should close on successful deletion
    expect(container.querySelector('.modal-backdrop')).toBeNull();
  });

  it('displays error message and preserves modal if deletion fails', async () => {
    vi.mocked(expenseRepository.deleteExpense).mockRejectedValueOnce(new Error('IndexedDB storage error'));

    await renderComponent();

    // Open modal
    const deleteBtn = container.querySelector('.btn-ledger-action.delete') as HTMLButtonElement;
    await act(async () => {
      deleteBtn.click();
    });

    const confirmBtn = container.querySelector('.btn-modal-delete') as HTMLButtonElement;

    await act(async () => {
      confirmBtn.click();
    });

    // Repository was called
    expect(expenseRepository.deleteExpense).toHaveBeenCalledWith('exp-123');

    // Modal stays open and displays error
    expect(container.querySelector('.modal-backdrop')).not.toBeNull();
    const errorMsg = container.querySelector('.modal-error-text');
    expect(errorMsg?.textContent).toBe('Unable to delete expense. Please try again.');
  });
});

describe('ExpensesView filter visibility and clearing behavior (DEF-04)', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockMonths: MonthData[] = [
    { id: '2026-10', label: 'October 2026', shortLabel: 'Oct 2026', isCurrentMonth: true },
    { id: '2026-09', label: 'September 2026', shortLabel: 'Sep 2026', isCurrentMonth: false },
  ];

  const multipleExpenses: Expense[] = [
    {
      id: 'exp-1',
      amountInPaise: 45000, // ₹450
      category: 'Food',
      paymentMethod: 'UPI',
      date: '2026-10-09',
      note: 'Team lunch',
      currency: 'INR',
      createdAt: '2026-10-09T10:00:00.000Z',
      updatedAt: '2026-10-09T10:00:00.000Z',
    },
    {
      id: 'exp-2',
      amountInPaise: 150000, // ₹1,500
      category: 'Travel',
      paymentMethod: 'Card',
      date: '2026-10-08',
      note: 'Train ticket',
      currency: 'INR',
      createdAt: '2026-10-08T10:00:00.000Z',
      updatedAt: '2026-10-08T10:00:00.000Z',
    },
    {
      id: 'exp-3',
      amountInPaise: 30000, // ₹300
      category: 'Food',
      paymentMethod: 'Cash',
      date: '2026-10-05',
      note: 'Groceries',
      currency: 'INR',
      createdAt: '2026-10-05T10:00:00.000Z',
      updatedAt: '2026-10-05T10:00:00.000Z',
    },
  ];

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

  it('does not display active-filters-banner when no filters are applied', async () => {
    await act(async () => {
      root.render(
        <ExpensesView
          months={mockMonths}
          selectedMonthId="2026-10"
          onSelectMonth={vi.fn()}
          expenses={multipleExpenses}
          onAddExpenseClick={vi.fn()}
          onEditExpense={vi.fn()}
        />
      );
    });

    expect(container.querySelector('.active-filters-banner')).toBeNull();
    // All 3 items rendered
    const items = container.querySelectorAll('.expense-ledger-item');
    expect(items.length).toBe(3);
  });

  it('displays active-filters-banner with transaction counts when category filter is selected', async () => {
    await act(async () => {
      root.render(
        <ExpensesView
          months={mockMonths}
          selectedMonthId="2026-10"
          onSelectMonth={vi.fn()}
          expenses={multipleExpenses}
          onAddExpenseClick={vi.fn()}
          onEditExpense={vi.fn()}
        />
      );
    });

    // Select "Food" category
    const categorySelect = container.querySelector('#filter-category-select') as HTMLSelectElement;
    expect(categorySelect).not.toBeNull();

    await act(async () => {
      categorySelect.value = 'Food';
      categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Active filters banner is rendered
    const banner = container.querySelector('.active-filters-banner');
    expect(banner).not.toBeNull();

    // Check count text: Showing 2 of 3 transactions
    const countText = container.querySelector('.active-filters-count-text');
    expect(countText?.textContent).toContain('Showing 2 of 3 transactions');

    // Check active filter tag
    const filterTag = container.querySelector('.active-filter-tag');
    expect(filterTag?.textContent).toContain('Category: Food');

    // Ledger shows only the 2 Food expenses
    const items = container.querySelectorAll('.expense-ledger-item');
    expect(items.length).toBe(2);
  });

  it('Clear Filters resets both category and payment filters and restores all transactions', async () => {
    await act(async () => {
      root.render(
        <ExpensesView
          months={mockMonths}
          selectedMonthId="2026-10"
          onSelectMonth={vi.fn()}
          expenses={multipleExpenses}
          onAddExpenseClick={vi.fn()}
          onEditExpense={vi.fn()}
        />
      );
    });

    const categorySelect = container.querySelector('#filter-category-select') as HTMLSelectElement;
    const methodSelect = container.querySelector('#filter-method-select') as HTMLSelectElement;

    // Apply both category and payment method filters
    await act(async () => {
      categorySelect.value = 'Food';
      categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
      methodSelect.value = 'UPI';
      methodSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Only 1 item matches (Food + UPI)
    let items = container.querySelectorAll('.expense-ledger-item');
    expect(items.length).toBe(1);

    // Banner is visible with Clear Filters button
    const clearBannerBtn = container.querySelector('.btn-clear-filters-banner') as HTMLButtonElement;
    expect(clearBannerBtn).not.toBeNull();

    // Click Clear Filters
    await act(async () => {
      clearBannerBtn.click();
    });

    // Filters should be cleared
    expect(categorySelect.value).toBe('');
    expect(methodSelect.value).toBe('');

    // Banner should disappear
    expect(container.querySelector('.active-filters-banner')).toBeNull();

    // All 3 expenses restored
    items = container.querySelectorAll('.expense-ledger-item');
    expect(items.length).toBe(3);
  });

  it('MAS-12: automatically resets active filters when navigating across months', async () => {
    const expenses: Expense[] = [
      {
        id: 'exp-1',
        amountInPaise: 10000,
        category: 'Food',
        paymentMethod: 'UPI',
        date: '2026-10-01',
        note: '',
        currency: 'INR',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      },
    ];

    await act(async () => {
      root.render(
        <ExpensesView
          months={[
            { id: '2026-10', label: 'October 2026', shortLabel: 'Oct 2026', isCurrentMonth: true },
            { id: '2026-09', label: 'September 2026', shortLabel: 'Sep 2026', isCurrentMonth: false },
          ]}
          selectedMonthId="2026-10"
          onSelectMonth={vi.fn()}
          expenses={expenses}
          onAddExpenseClick={vi.fn()}
          onEditExpense={vi.fn()}
        />
      );
    });

    const categorySelect = container.querySelector('#filter-category-select') as HTMLSelectElement;

    // Apply a category filter
    await act(async () => {
      categorySelect.value = 'Food';
      categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(categorySelect.value).toBe('Food');
    expect(container.querySelector('.active-filters-banner')).not.toBeNull();

    // Re-render with new selectedMonthId (simulating user selecting September)
    await act(async () => {
      root.render(
        <ExpensesView
          months={[
            { id: '2026-10', label: 'October 2026', shortLabel: 'Oct 2026', isCurrentMonth: false },
            { id: '2026-09', label: 'September 2026', shortLabel: 'Sep 2026', isCurrentMonth: true },
          ]}
          selectedMonthId="2026-09"
          onSelectMonth={vi.fn()}
          expenses={[]}
          onAddExpenseClick={vi.fn()}
          onEditExpense={vi.fn()}
        />
      );
    });

    // Verify filters are automatically cleared
    const updatedSelect = container.querySelector('#filter-category-select') as HTMLSelectElement;
    expect(updatedSelect.value).toBe('');
    expect(container.querySelector('.active-filters-banner')).toBeNull();
  });
});
