import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { LoansView } from './LoansView';
import { loanRepository } from '../repositories/loanRepository';

// Configure React act environment for testing
// @ts-expect-error global act flag for react 19
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { sampleActiveLoan, sampleInactiveLoan } = vi.hoisted(() => ({
  sampleActiveLoan: {
    id: 'loan-active-1',
    name: 'Education Loan',
    loanType: 'Education',
    principalAmountInPaise: 100000000, // ₹10,00,000
    outstandingAmountInPaise: 75000000,
    interestRatePercent: 9.0,
    emiAmountInPaise: 1500000,
    dueDay: 5,
    remainingTenureMonths: 60,
    startDate: '2025-06-01',
    isActive: true,
    createdAt: '2025-06-01T00:00:00.000Z',
    updatedAt: '2025-06-01T00:00:00.000Z',
  },
  sampleInactiveLoan: {
    id: 'loan-inactive-1',
    name: 'Personal Loan',
    loanType: 'Personal',
    principalAmountInPaise: 20000000, // ₹2,00,000
    outstandingAmountInPaise: 0,
    interestRatePercent: 12.0,
    emiAmountInPaise: 1000000,
    dueDay: 15,
    remainingTenureMonths: 0,
    startDate: '2024-01-15',
    isActive: false,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2025-01-15T00:00:00.000Z',
  },
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (queryFn: () => any) => {
    const str = queryFn.toString();
    if (str.includes('loans') || str.includes('getLoans')) {
      return [sampleActiveLoan, sampleInactiveLoan];
    }
    if (str.includes('dashboardPreferences') || str.includes('getPreferences')) {
      return { showUpcomingObligations: true, showLoansSummary: true };
    }
    return [];
  },
}));

vi.mock('../repositories/loanRepository', () => ({
  loanRepository: {
    getLoans: vi.fn().mockResolvedValue([sampleActiveLoan, sampleInactiveLoan]),
    addLoan: vi.fn(),
    updateLoan: vi.fn(),
    updateOutstandingBalance: vi.fn(),
    deactivateLoan: vi.fn(),
    reactivateLoan: vi.fn(),
    deleteLoan: vi.fn(),
  },
}));

vi.mock('../repositories/dashboardPreferencesRepository', () => ({
  DEFAULT_DASHBOARD_PREFERENCES: { showUpcomingObligations: true, showLoansSummary: true },
  dashboardPreferencesRepository: {
    getPreferences: vi.fn().mockResolvedValue({ showUpcomingObligations: true, showLoansSummary: true }),
    updateLoansVisibility: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('LoansView - MAS-08 deletion and MAS-09 error feedback', () => {
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
      root.render(<LoansView onBack={vi.fn()} />);
    });
  };

  it('MAS-08: opens delete confirmation dialog and cancels without calling repository', async () => {
    await renderComponent();

    const deleteBtn = container.querySelector('.btn-card-icon.delete') as HTMLButtonElement;
    expect(deleteBtn).toBeTruthy();

    await act(async () => {
      deleteBtn.click();
    });

    const modal = container.querySelector('.modal-card');
    expect(modal).toBeTruthy();
    expect(modal?.textContent).toContain('Delete Loan?');
    expect(modal?.textContent).toContain('Education Loan');

    const cancelBtn = container.querySelector('.btn-modal-cancel') as HTMLButtonElement;
    expect(cancelBtn).toBeTruthy();

    await act(async () => {
      cancelBtn.click();
    });

    expect(container.querySelector('.modal-card')).toBeNull();
    expect(loanRepository.deleteLoan).not.toHaveBeenCalled();
  });

  it('MAS-08: confirms delete, invokes loanRepository.deleteLoan, and displays success toast', async () => {
    vi.mocked(loanRepository.deleteLoan).mockResolvedValueOnce(undefined);
    await renderComponent();

    const deleteBtn = container.querySelector('.btn-card-icon.delete') as HTMLButtonElement;
    await act(async () => {
      deleteBtn.click();
    });

    const confirmBtn = container.querySelector('.btn-modal-delete') as HTMLButtonElement;
    await act(async () => {
      confirmBtn.click();
    });

    expect(loanRepository.deleteLoan).toHaveBeenCalledWith('loan-active-1');
    const toast = container.querySelector('.toast-notification');
    expect(toast?.textContent).toContain('Deleted loan "Education Loan"');
  });

  it('MAS-08: displays visible error toast when loan deletion fails', async () => {
    vi.mocked(loanRepository.deleteLoan).mockRejectedValueOnce(
      new Error('IndexedDB storage failure')
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
    expect(toast?.textContent).toContain('Failed to delete loan. Please try again.');
  });

  it('MAS-09: displays visible error toast when close loan (deactivation) fails', async () => {
    vi.mocked(loanRepository.deactivateLoan).mockRejectedValueOnce(
      new Error('DB transaction abort')
    );
    await renderComponent();

    const closeBtn = container.querySelector('.btn-card-action.deactivate') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();

    await act(async () => {
      closeBtn.click();
    });

    const toast = container.querySelector('.toast-notification');
    expect(toast?.textContent).toContain('Failed to close loan. Please try again.');
  });

  it('MAS-09: displays visible error toast when reopening loan (reactivation) fails', async () => {
    vi.mocked(loanRepository.reactivateLoan).mockRejectedValueOnce(
      new Error('DB transaction abort')
    );
    await renderComponent();

    // Switch to Closed loans tab
    const tabs = container.querySelectorAll('.loans-subtab-btn');
    const closedTab = tabs[1] as HTMLButtonElement;
    expect(closedTab).toBeTruthy();

    await act(async () => {
      closedTab.click();
    });

    const reopenBtn = container.querySelector('.btn-card-action.reactivate') as HTMLButtonElement;
    expect(reopenBtn).toBeTruthy();

    await act(async () => {
      reopenBtn.click();
    });

    const toast = container.querySelector('.toast-notification');
    expect(toast?.textContent).toContain('Failed to reactivate loan. Please try again.');
  });
});
