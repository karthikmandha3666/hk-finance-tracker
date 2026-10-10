import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loanRepository } from './loanRepository';
import { db } from '../db/db';
import type { Loan } from '../types';

vi.mock('../db/db', () => ({
  db: {
    loans: {
      get: vi.fn(),
      add: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      toArray: vi.fn(),
      filter: vi.fn(),
    },
  },
}));

const mockDb = db as unknown as {
  loans: {
    get: ReturnType<typeof vi.fn>;
    add: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    toArray: ReturnType<typeof vi.fn>;
    filter: ReturnType<typeof vi.fn>;
  };
};

describe('loanRepository - MAS-08 lifecycle & deletion', () => {
  const sampleLoan: Loan = {
    id: 'loan-1',
    name: 'Home Loan',
    loanType: 'Home',
    principalAmountInPaise: 500000000, // ₹50,00,000
    outstandingAmountInPaise: 420000000,
    interestRatePercent: 8.5,
    emiAmountInPaise: 4500000,
    dueDay: 10,
    remainingTenureMonths: 180,
    startDate: '2025-01-10',
    isActive: true,
    createdAt: '2025-01-10T00:00:00.000Z',
    updatedAt: '2025-01-10T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permanently deletes an existing loan record by ID', async () => {
    mockDb.loans.get.mockResolvedValue({ ...sampleLoan });
    mockDb.loans.delete.mockResolvedValue(undefined);

    await loanRepository.deleteLoan('loan-1');

    expect(mockDb.loans.get).toHaveBeenCalledWith('loan-1');
    expect(mockDb.loans.delete).toHaveBeenCalledWith('loan-1');
  });

  it('throws an error when attempting to delete a non-existent loan', async () => {
    mockDb.loans.get.mockResolvedValue(undefined);

    await expect(loanRepository.deleteLoan('non-existent-loan')).rejects.toThrow(
      'Loan with ID "non-existent-loan" not found.'
    );
    expect(mockDb.loans.delete).not.toHaveBeenCalled();
  });

  it('deactivates (closes) a loan by setting isActive to false', async () => {
    mockDb.loans.get.mockResolvedValue({ ...sampleLoan });
    mockDb.loans.put.mockResolvedValue('loan-1');

    const result = await loanRepository.deactivateLoan('loan-1');

    expect(result.isActive).toBe(false);
    expect(mockDb.loans.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'loan-1',
        isActive: false,
      })
    );
  });

  it('reactivates a closed loan by setting isActive to true', async () => {
    mockDb.loans.get.mockResolvedValue({ ...sampleLoan, isActive: false });
    mockDb.loans.put.mockResolvedValue('loan-1');

    const result = await loanRepository.reactivateLoan('loan-1');

    expect(result.isActive).toBe(true);
    expect(mockDb.loans.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'loan-1',
        isActive: true,
      })
    );
  });
});
