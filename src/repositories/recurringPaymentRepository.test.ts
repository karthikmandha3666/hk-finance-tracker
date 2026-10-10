import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recurringPaymentRepository } from './recurringPaymentRepository';
import { db } from '../db/db';
import type { RecurringPayment } from '../types';

vi.mock('../db/db', () => ({
  db: {
    transaction: vi.fn(async (_mode: string, _table: any, fn: () => Promise<any>) => fn()),
    recurringPayments: {
      get: vi.fn(),
      put: vi.fn(),
      add: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const mockDb = db as unknown as {
  transaction: ReturnType<typeof vi.fn>;
  recurringPayments: {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    add: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

describe('recurringPaymentRepository - MAS-01 concurrency protection', () => {
  const sampleMonthlyPayment: RecurringPayment = {
    id: 'rec-monthly-1',
    name: 'Netflix Subscription',
    amountInPaise: 49900,
    category: 'Subscription',
    paymentMethod: 'Credit Card',
    frequency: 'Monthly',
    nextDueDate: '2026-10-15',
    anchorDay: 15,
    isActive: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  const sampleOneTimePayment: RecurringPayment = {
    id: 'rec-onetime-1',
    name: 'Car Repair Deposit',
    amountInPaise: 500000,
    category: 'Bills',
    paymentMethod: 'UPI',
    frequency: 'One-time',
    nextDueDate: '2026-10-20',
    isActive: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deduplicates concurrent repository calls for the same payment ID and advances date exactly once', async () => {
    let putResolve: () => void;
    const putPromise = new Promise<void>((resolve) => {
      putResolve = resolve;
    });

    mockDb.recurringPayments.get.mockResolvedValue({ ...sampleMonthlyPayment });
    mockDb.recurringPayments.put.mockImplementation(async () => {
      await putPromise;
      return 'rec-monthly-1';
    });

    // Fire two concurrent markAsPaid calls simultaneously
    const call1 = recurringPaymentRepository.markAsPaid('rec-monthly-1');
    const call2 = recurringPaymentRepository.markAsPaid('rec-monthly-1');

    // Release the database write
    putResolve!();

    const [res1, res2] = await Promise.all([call1, call2]);

    // Both calls must resolve to the exact same updated record
    expect(res1).toBe(res2);
    expect(res1.nextDueDate).toBe('2026-11-15'); // Advanced exactly 1 month, NOT 2 months
    expect(res1.anchorDay).toBe(15);

    // Database read and write must be executed exactly once
    expect(mockDb.recurringPayments.get).toHaveBeenCalledTimes(1);
    expect(mockDb.recurringPayments.put).toHaveBeenCalledTimes(1);
  });

  it('preserves monthly anchor-day behavior when advancing across months', async () => {
    const paymentJan31: RecurringPayment = {
      ...sampleMonthlyPayment,
      id: 'rec-jan-31',
      nextDueDate: '2026-01-31',
      anchorDay: 31,
    };

    mockDb.recurringPayments.get.mockResolvedValue({ ...paymentJan31 });
    mockDb.recurringPayments.put.mockResolvedValue('rec-jan-31');

    const result = await recurringPaymentRepository.markAsPaid('rec-jan-31');
    // In 2026, Feb has 28 days, but anchorDay remains 31
    expect(result.nextDueDate).toBe('2026-02-28');
    expect(result.anchorDay).toBe(31);
    expect(result.isActive).toBe(true);
  });

  it('completes one-time payment by setting isActive to false without advancing nextDueDate', async () => {
    mockDb.recurringPayments.get.mockResolvedValue({ ...sampleOneTimePayment });
    mockDb.recurringPayments.put.mockResolvedValue('rec-onetime-1');

    const result = await recurringPaymentRepository.markAsPaid('rec-onetime-1');
    expect(result.isActive).toBe(false);
    expect(result.nextDueDate).toBe('2026-10-20'); // Unchanged
    expect(mockDb.recurringPayments.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rec-onetime-1',
        isActive: false,
        nextDueDate: '2026-10-20',
      })
    );
  });

  it('releases in-flight lock after a write failure, allowing subsequent retry', async () => {
    mockDb.recurringPayments.get.mockResolvedValue({ ...sampleMonthlyPayment });
    mockDb.recurringPayments.put.mockRejectedValueOnce(new Error('IndexedDB disk write failure'));

    // First attempt fails
    await expect(recurringPaymentRepository.markAsPaid('rec-monthly-1')).rejects.toThrow(
      'IndexedDB disk write failure'
    );

    // Lock must be released! Now simulate successful write on retry
    mockDb.recurringPayments.put.mockResolvedValueOnce('rec-monthly-1');

    const retryResult = await recurringPaymentRepository.markAsPaid('rec-monthly-1');
    expect(retryResult.nextDueDate).toBe('2026-11-15');
    expect(mockDb.recurringPayments.put).toHaveBeenCalledTimes(2);
  });

  it('releases lock when payment ID is not found and rejects with clear error', async () => {
    mockDb.recurringPayments.get.mockResolvedValue(undefined);

    await expect(recurringPaymentRepository.markAsPaid('non-existent-id')).rejects.toThrow(
      'Recurring payment with ID "non-existent-id" not found.'
    );

    // Second call should also query and not be stuck in lock
    await expect(recurringPaymentRepository.markAsPaid('non-existent-id')).rejects.toThrow(
      'Recurring payment with ID "non-existent-id" not found.'
    );
    expect(mockDb.recurringPayments.get).toHaveBeenCalledTimes(2);
  });

  it('processes concurrent calls for different payment IDs independently', async () => {
    const payment1 = { ...sampleMonthlyPayment, id: 'p1', nextDueDate: '2026-10-10', anchorDay: 10 };
    const payment2 = { ...sampleMonthlyPayment, id: 'p2', nextDueDate: '2026-10-25', anchorDay: 25 };

    mockDb.recurringPayments.get.mockImplementation(async (id: string) => {
      if (id === 'p1') return { ...payment1 };
      if (id === 'p2') return { ...payment2 };
      return undefined;
    });
    mockDb.recurringPayments.put.mockResolvedValue('ok');

    const [res1, res2] = await Promise.all([
      recurringPaymentRepository.markAsPaid('p1'),
      recurringPaymentRepository.markAsPaid('p2'),
    ]);

    expect(res1.nextDueDate).toBe('2026-11-10');
    expect(res2.nextDueDate).toBe('2026-11-25');
    expect(mockDb.recurringPayments.get).toHaveBeenCalledTimes(2);
    expect(mockDb.recurringPayments.put).toHaveBeenCalledTimes(2);
  });

  it('rejects stale request when expectedCurrentDueDate does not match current due date (cross-tab protection)', async () => {
    // Current due date in DB has already been advanced to 2026-11-15 by another tab
    const alreadyAdvanced = {
      ...sampleMonthlyPayment,
      nextDueDate: '2026-11-15',
    };
    mockDb.recurringPayments.get.mockResolvedValue({ ...alreadyAdvanced });

    // Stale caller from another tab still expects 2026-10-15
    const result = await recurringPaymentRepository.markAsPaid('rec-monthly-1', '2026-10-15');

    // Due date must NOT advance to 2026-12-15; must return existing record
    expect(result.nextDueDate).toBe('2026-11-15');
    expect(mockDb.recurringPayments.put).not.toHaveBeenCalled();
  });

  it('advances normally when expectedCurrentDueDate matches current due date', async () => {
    mockDb.recurringPayments.get.mockResolvedValue({ ...sampleMonthlyPayment });
    mockDb.recurringPayments.put.mockResolvedValue('ok');

    const result = await recurringPaymentRepository.markAsPaid('rec-monthly-1', '2026-10-15');

    expect(result.nextDueDate).toBe('2026-11-15');
    expect(mockDb.recurringPayments.put).toHaveBeenCalledTimes(1);
  });

  it('does not write or advance when one-time payment is already inactive (cross-tab idempotency)', async () => {
    const alreadyCompleted = {
      ...sampleOneTimePayment,
      isActive: false,
    };
    mockDb.recurringPayments.get.mockResolvedValue({ ...alreadyCompleted });

    const result = await recurringPaymentRepository.markAsPaid('rec-onetime-1');

    expect(result.isActive).toBe(false);
    expect(mockDb.recurringPayments.put).not.toHaveBeenCalled();
  });

  it('permanently deletes an existing recurring payment record', async () => {
    mockDb.recurringPayments.get.mockResolvedValue({ ...sampleMonthlyPayment });
    mockDb.recurringPayments.delete.mockResolvedValue(undefined);

    await recurringPaymentRepository.deleteRecurringPayment('rec-monthly-1');

    expect(mockDb.recurringPayments.delete).toHaveBeenCalledWith('rec-monthly-1');
  });

  it('throws error when deleting a non-existent recurring payment record', async () => {
    mockDb.recurringPayments.get.mockResolvedValue(undefined);

    await expect(recurringPaymentRepository.deleteRecurringPayment('non-existent-id')).rejects.toThrow(
      'Recurring payment with ID "non-existent-id" not found.'
    );
    expect(mockDb.recurringPayments.delete).not.toHaveBeenCalled();
  });
});
