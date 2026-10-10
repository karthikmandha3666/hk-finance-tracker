import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { BudgetsView } from './BudgetsView';
import type { Expense, MonthData } from '../types';

// Configure React act environment for testing
// @ts-expect-error global act flag for react 19
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('BudgetsView - MAS-03 Production budget calculations & rendered DOM', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockMonths: MonthData[] = [
    { id: '2026-10', label: 'October 2026', shortLabel: 'Oct 2026', isCurrentMonth: true },
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

  const renderBudgetsView = async (props: {
    monthlyBudgetPaise: number | null;
    monthlyIncomePaise?: number | null;
    expenses: Expense[];
  }) => {
    await act(async () => {
      root.render(
        <BudgetsView
          months={mockMonths}
          selectedMonthId="2026-10"
          monthlyBudgetPaise={props.monthlyBudgetPaise}
          monthlyIncomePaise={props.monthlyIncomePaise ?? 5000000}
          expenses={props.expenses}
          onSelectMonth={vi.fn()}
          onOpenEditIncome={vi.fn()}
          onOpenEditBudget={vi.fn()}
          onAddExpenseClick={vi.fn()}
        />
      );
    });
  };

  const createExpense = (id: string, amountInPaise: number, category = 'Food'): Expense => ({
    id,
    amountInPaise,
    category,
    paymentMethod: 'UPI',
    date: '2026-10-10',
    note: '',
    currency: 'INR',
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
  });

  it('renders unset budget empty state without allocated numbers, NaN, or Infinity', async () => {
    await renderBudgetsView({
      monthlyBudgetPaise: null,
      expenses: [createExpense('e1', 50000)],
    });

    const emptyTitle = container.querySelector('.empty-budget-title');
    expect(emptyTitle).toBeTruthy();
    expect(emptyTitle?.textContent).toBe('Budget not set');

    const setBudgetBtn = container.querySelector('.btn-set-budget-cta');
    expect(setBudgetBtn).toBeTruthy();
    expect(setBudgetBtn?.textContent).toContain('+ Set Monthly Budget');

    expect(container.querySelector('.budget-amount-val')).toBeNull();
    expect(container.querySelector('.budget-progress-track')).toBeNull();

    // Verification: No NaN or Infinity in entire rendered markup
    expect(container.innerHTML).not.toContain('NaN');
    expect(container.innerHTML).not.toContain('Infinity');
  });

  it('renders explicit ₹0 budget with zero spending: displays ₹0 remaining, 0% used, and On Track', async () => {
    await renderBudgetsView({
      monthlyBudgetPaise: 0,
      expenses: [],
    });

    const allocatedAmount = container.querySelector('.budget-amount-val');
    expect(allocatedAmount?.textContent).toContain('₹0');

    const spentLabel = container.querySelector('.budget-progress-spent-text');
    expect(spentLabel?.textContent).toBe('Spent: ₹0');

    const usageBadge = container.querySelector('.budget-usage-badge');
    expect(usageBadge?.textContent).toBe('0% used');
    expect(usageBadge?.classList.contains('over-budget')).toBe(false);

    const remainingVal = container.querySelector('.stat-col-val');
    expect(remainingVal?.textContent).toBe('₹0');

    const statusPill = container.querySelector('.stat-status-pill');
    expect(statusPill?.textContent).toBe('On Track');
    expect(statusPill?.classList.contains('on-track')).toBe(true);

    const progressBar = container.querySelector('.budget-progress-bar') as HTMLElement;
    expect(progressBar?.style.width).toBe('0%');

    // No NaN or Infinity
    expect(container.innerHTML).not.toContain('NaN');
    expect(container.innerHTML).not.toContain('Infinity');
  });

  it('renders explicit ₹0 budget with positive spending: displays actual deficit and Over ₹0 Limit pill without NaN or Infinity', async () => {
    await renderBudgetsView({
      monthlyBudgetPaise: 0,
      expenses: [createExpense('e1', 50000)], // ₹500
    });

    const allocatedAmount = container.querySelector('.budget-amount-val');
    expect(allocatedAmount?.textContent).toContain('₹0');

    const spentLabel = container.querySelector('.budget-progress-spent-text');
    expect(spentLabel?.textContent).toBe('Spent: ₹500');

    const usageBadge = container.querySelector('.budget-usage-badge');
    expect(usageBadge?.textContent).toBe('Over ₹0 limit by ₹500');
    expect(usageBadge?.classList.contains('over-budget')).toBe(true);

    const remainingVal = container.querySelector('.stat-col-val');
    expect(remainingVal?.textContent).toBe('-₹500');
    expect(remainingVal?.classList.contains('text-rose')).toBe(true);

    const statusPill = container.querySelector('.stat-status-pill');
    expect(statusPill?.textContent).toBe('Over ₹0 Limit');
    expect(statusPill?.classList.contains('over-budget')).toBe(true);

    const progressBar = container.querySelector('.budget-progress-bar') as HTMLElement;
    expect(progressBar?.style.width).toBe('100%');
    expect(progressBar?.classList.contains('progress-alert')).toBe(true);

    // No NaN or Infinity
    expect(container.innerHTML).not.toContain('NaN');
    expect(container.innerHTML).not.toContain('Infinity');
  });

  it('renders positive budget with zero spending: displays 0% used, full remaining, and On Track', async () => {
    await renderBudgetsView({
      monthlyBudgetPaise: 1000000, // ₹10,000
      expenses: [],
    });

    const allocatedAmount = container.querySelector('.budget-amount-val');
    expect(allocatedAmount?.textContent).toContain('₹10,000');

    const spentLabel = container.querySelector('.budget-progress-spent-text');
    expect(spentLabel?.textContent).toBe('Spent: ₹0');

    const usageBadge = container.querySelector('.budget-usage-badge');
    expect(usageBadge?.textContent).toBe('0% used');

    const remainingVal = container.querySelector('.stat-col-val');
    expect(remainingVal?.textContent).toBe('₹10,000');
    expect(remainingVal?.classList.contains('text-emerald')).toBe(true);

    const statusPill = container.querySelector('.stat-status-pill');
    expect(statusPill?.textContent).toBe('On Track');

    const progressBar = container.querySelector('.budget-progress-bar') as HTMLElement;
    expect(progressBar?.style.width).toBe('0%');

    // No NaN or Infinity
    expect(container.innerHTML).not.toContain('NaN');
    expect(container.innerHTML).not.toContain('Infinity');
  });

  it('renders positive budget with positive spending on track: displays exact percentage, remaining, and On Track', async () => {
    await renderBudgetsView({
      monthlyBudgetPaise: 1000000, // ₹10,000
      expenses: [createExpense('e1', 400000)], // ₹4,000
    });

    const allocatedAmount = container.querySelector('.budget-amount-val');
    expect(allocatedAmount?.textContent).toContain('₹10,000');

    const spentLabel = container.querySelector('.budget-progress-spent-text');
    expect(spentLabel?.textContent).toBe('Spent: ₹4,000');

    const usageBadge = container.querySelector('.budget-usage-badge');
    expect(usageBadge?.textContent).toBe('40% used');
    expect(usageBadge?.classList.contains('over-budget')).toBe(false);

    const remainingVal = container.querySelector('.stat-col-val');
    expect(remainingVal?.textContent).toBe('₹6,000');
    expect(remainingVal?.classList.contains('text-emerald')).toBe(true);

    const statusPill = container.querySelector('.stat-status-pill');
    expect(statusPill?.textContent).toBe('On Track');

    const progressBar = container.querySelector('.budget-progress-bar') as HTMLElement;
    expect(progressBar?.style.width).toBe('40%');

    // No NaN or Infinity
    expect(container.innerHTML).not.toContain('NaN');
    expect(container.innerHTML).not.toContain('Infinity');
  });

  it('renders positive budget with overspending: displays >100% usage, negative remaining, Over Budget, and clamped bar', async () => {
    await renderBudgetsView({
      monthlyBudgetPaise: 1000000, // ₹10,000
      expenses: [createExpense('e1', 1250000)], // ₹12,500
    });

    const allocatedAmount = container.querySelector('.budget-amount-val');
    expect(allocatedAmount?.textContent).toContain('₹10,000');

    const spentLabel = container.querySelector('.budget-progress-spent-text');
    expect(spentLabel?.textContent).toBe('Spent: ₹12,500');

    const usageBadge = container.querySelector('.budget-usage-badge');
    expect(usageBadge?.textContent).toBe('125% used');
    expect(usageBadge?.classList.contains('over-budget')).toBe(true);

    const remainingVal = container.querySelector('.stat-col-val');
    expect(remainingVal?.textContent).toBe('-₹2,500');
    expect(remainingVal?.classList.contains('text-rose')).toBe(true);

    const statusPill = container.querySelector('.stat-status-pill');
    expect(statusPill?.textContent).toBe('Over Budget');
    expect(statusPill?.classList.contains('over-budget')).toBe(true);

    const progressBar = container.querySelector('.budget-progress-bar') as HTMLElement;
    expect(progressBar?.style.width).toBe('100%');
    expect(progressBar?.classList.contains('progress-alert')).toBe(true);

    // No NaN or Infinity
    expect(container.innerHTML).not.toContain('NaN');
    expect(container.innerHTML).not.toContain('Infinity');
  });
});
