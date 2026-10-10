import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { UpcomingPaymentsView } from './UpcomingPaymentsView';
import { recurringPaymentRepository } from '../repositories/recurringPaymentRepository';
import type { RecurringPayment } from '../types';

// Configure React act environment for testing
// @ts-expect-error global act flag for react 19
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { samplePayment } = vi.hoisted(() => ({
  samplePayment: {
    id: 'rec-test-1',
    name: 'Gym Membership',
    amountInPaise: 200000,
    category: 'Health',
    paymentMethod: 'UPI',
    frequency: 'Monthly' as const,
    nextDueDate: '2026-10-15',
    anchorDay: 15,
    isActive: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
}));

// Mock dexie-react-hooks
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (queryFn: () => any) => {
    // Provide sample payment data for queries
    const str = queryFn.toString();
    if (str.includes('recurringPayments') || str.includes('getRecurringPayments')) {
      return [samplePayment];
    }
    if (str.includes('categories') || str.includes('getActiveCategories')) {
      return [{ id: 'c1', name: 'Health', isDefault: true, isActive: true }];
    }
    if (str.includes('paymentMethods') || str.includes('getActivePaymentMethods')) {
      return [{ id: 'pm1', name: 'UPI', isDefault: true, isActive: true }];
    }
    if (str.includes('dashboardPreferences') || str.includes('getPreferences')) {
      return { showUpcomingObligations: true, showLoansSummary: true };
    }
    return [];
  },
}));

// Mock recurringPaymentRepository
vi.mock('../repositories/recurringPaymentRepository', () => ({
  recurringPaymentRepository: {
    getRecurringPayments: vi.fn().mockResolvedValue([samplePayment]),
    markAsPaid: vi.fn(),
    addRecurringPayment: vi.fn(),
    updateRecurringPayment: vi.fn(),
    deactivateRecurringPayment: vi.fn(),
    reactivateRecurringPayment: vi.fn(),
    deleteRecurringPayment: vi.fn(),
  },
}));

vi.mock('../repositories/categoryRepository', () => ({
  categoryRepository: {
    getActiveCategories: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../repositories/paymentMethodRepository', () => ({
  paymentMethodRepository: {
    getActivePaymentMethods: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../repositories/dashboardPreferencesRepository', () => ({
  DEFAULT_DASHBOARD_PREFERENCES: { showUpcomingObligations: true, showLoansSummary: true },
  dashboardPreferencesRepository: {
    getPreferences: vi.fn().mockResolvedValue({ showUpcomingObligations: true, showLoansSummary: true }),
    updateUpcomingVisibility: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('UpcomingPaymentsView - MAS-01 UI concurrency & double-click protection', () => {
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

  const renderComponent = async () => {
    await act(async () => {
      root.render(<UpcomingPaymentsView onBack={vi.fn()} />);
    });
  };

  it('disables button on click and prevents double-submission on rapid repeated clicks', async () => {
    let resolveMark: (value: RecurringPayment) => void;
    const pendingPromise = new Promise<RecurringPayment>((resolve) => {
      resolveMark = resolve;
    });

    vi.mocked(recurringPaymentRepository.markAsPaid).mockImplementation(() => pendingPromise);

    await renderComponent();

    const markPaidBtn = container.querySelector('.btn-mark-paid') as HTMLButtonElement;
    expect(markPaidBtn).toBeTruthy();
    expect(markPaidBtn.disabled).toBe(false);
    expect(markPaidBtn.textContent).toContain('Mark as Paid');

    // First click: triggers operation and enters processing state
    await act(async () => {
      markPaidBtn.click();
    });

    // In-flight state: button must be disabled, aria-busy=true, text="Processing..."
    expect(markPaidBtn.disabled).toBe(true);
    expect(markPaidBtn.getAttribute('aria-busy')).toBe('true');
    expect(markPaidBtn.textContent).toContain('Processing...');
    expect(recurringPaymentRepository.markAsPaid).toHaveBeenCalledTimes(1);

    // Rapid second click while in-flight
    await act(async () => {
      markPaidBtn.click();
    });

    // Repository must NOT have been called a second time
    expect(recurringPaymentRepository.markAsPaid).toHaveBeenCalledTimes(1);

    // Resolve the in-flight promise
    await act(async () => {
      resolveMark!({
        ...samplePayment,
        nextDueDate: '2026-11-15',
      });
    });

    // After resolution, processing lock is released and button is re-enabled
    expect(markPaidBtn.disabled).toBe(false);
    expect(markPaidBtn.textContent).toContain('Mark as Paid');
  });

  it('releases lock upon write failure, displays error feedback, and allows retry', async () => {
    vi.mocked(recurringPaymentRepository.markAsPaid).mockRejectedValueOnce(
      new Error('IndexedDB transaction aborted')
    );

    await renderComponent();

    const markPaidBtn = container.querySelector('.btn-mark-paid') as HTMLButtonElement;
    expect(markPaidBtn).toBeTruthy();

    // First attempt fails
    await act(async () => {
      markPaidBtn.click();
    });

    // Error feedback message displayed
    const feedbackBanner = container.querySelector('.toast-notification');
    expect(feedbackBanner).toBeTruthy();
    expect(feedbackBanner?.textContent).toContain('Failed to mark payment as paid. Please try again.');

    // Button lock must be released
    expect(markPaidBtn.disabled).toBe(false);
    expect(markPaidBtn.textContent).toContain('Mark as Paid');
    expect(recurringPaymentRepository.markAsPaid).toHaveBeenCalledTimes(1);

    // Now configure repository to succeed on retry
    vi.mocked(recurringPaymentRepository.markAsPaid).mockResolvedValueOnce({
      ...samplePayment,
      nextDueDate: '2026-11-15',
    });

    // Retry click
    await act(async () => {
      markPaidBtn.click();
    });

    // Repository called a second time (retry succeeded)
    expect(recurringPaymentRepository.markAsPaid).toHaveBeenCalledTimes(2);
    expect(markPaidBtn.disabled).toBe(false);
  });

  it('MAS-08: opens delete confirmation dialog and cancels without calling repository', async () => {
    await renderComponent();

    const deleteBtn = container.querySelector('.btn-card-icon.delete') as HTMLButtonElement;
    expect(deleteBtn).toBeTruthy();

    await act(async () => {
      deleteBtn.click();
    });

    // Confirmation dialog must appear
    const modal = container.querySelector('.modal-card');
    expect(modal).toBeTruthy();
    expect(modal?.textContent).toContain('Delete Recurring Payment?');
    expect(modal?.textContent).toContain('Gym Membership');

    // Click cancel
    const cancelBtn = container.querySelector('.btn-modal-cancel') as HTMLButtonElement;
    expect(cancelBtn).toBeTruthy();
    await act(async () => {
      cancelBtn.click();
    });

    // Dialog must be dismissed and repository not called
    expect(container.querySelector('.modal-card')).toBeNull();
    expect(recurringPaymentRepository.deleteRecurringPayment).not.toHaveBeenCalled();
  });

  it('MAS-08: confirms delete, invokes repository, and shows feedback toast', async () => {
    vi.mocked(recurringPaymentRepository.deleteRecurringPayment).mockResolvedValueOnce(undefined);
    await renderComponent();

    const deleteBtn = container.querySelector('.btn-card-icon.delete') as HTMLButtonElement;
    await act(async () => {
      deleteBtn.click();
    });

    const confirmBtn = container.querySelector('.btn-modal-delete') as HTMLButtonElement;
    expect(confirmBtn).toBeTruthy();

    await act(async () => {
      confirmBtn.click();
    });

    expect(recurringPaymentRepository.deleteRecurringPayment).toHaveBeenCalledWith('rec-test-1');
    const toast = container.querySelector('.toast-notification');
    expect(toast?.textContent).toContain('Deleted "Gym Membership"');
  });

  it('MAS-08: displays visible error toast when deletion fails', async () => {
    vi.mocked(recurringPaymentRepository.deleteRecurringPayment).mockRejectedValueOnce(
      new Error('IndexedDB deletion error')
    );
    await renderComponent();

    const deleteBtn = container.querySelector('.btn-card-icon.delete') as HTMLButtonElement;
    await act(async () => {
      deleteBtn.click();
    });

    const confirmBtn = container.querySelector('.btn-modal-delete') as HTMLButtonElement;
    await act(async () => {
      confirmBtn.click();
    });

    const toast = container.querySelector('.toast-notification');
    expect(toast?.textContent).toContain('Failed to delete payment. Please try again.');
  });

  it('MAS-09: displays visible error toast when deactivation fails and permits retry', async () => {
    vi.mocked(recurringPaymentRepository.deactivateRecurringPayment).mockRejectedValueOnce(
      new Error('Storage failure')
    );
    await renderComponent();

    const deactivateBtn = container.querySelector('.btn-card-action.deactivate') as HTMLButtonElement;
    expect(deactivateBtn).toBeTruthy();

    await act(async () => {
      deactivateBtn.click();
    });

    const toast = container.querySelector('.toast-notification');
    expect(toast?.textContent).toContain('Failed to deactivate payment. Please try again.');

    // Retry should be possible
    vi.mocked(recurringPaymentRepository.deactivateRecurringPayment).mockResolvedValueOnce({
      ...samplePayment,
      isActive: false,
    });

    await act(async () => {
      deactivateBtn.click();
    });

    expect(recurringPaymentRepository.deactivateRecurringPayment).toHaveBeenCalledTimes(2);
  });
});
