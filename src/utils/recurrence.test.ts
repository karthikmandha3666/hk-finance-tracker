import { describe, it, expect, vi } from 'vitest';
import { advanceDueDate } from './finance';
import { recurringPaymentRepository } from '../repositories/recurringPaymentRepository';
import type { RecurringPayment } from '../types';

vi.mock('../db/db', () => ({
  db: {
    recurringPayments: {
      get: vi.fn(),
      put: vi.fn(),
      add: vi.fn(),
    },
  },
}));

describe('advanceDueDate recurrence and month-end clamping behavior', () => {
  describe('Monthly recurrence with anchorDay preservation', () => {
    it('handles January 31 -> February (non-leap year 2026) -> March preserving 31st', () => {
      // Starting on Jan 31 with anchorDay 31
      const janDate = '2026-01-31';
      const febDate = advanceDueDate(janDate, 'Monthly', 31);
      // February 2026 has 28 days -> clamped to 28
      expect(febDate).toBe('2026-02-28');

      // Advancing from February 28 using anchorDay 31 -> March has 31 days -> restored to 31
      const marDate = advanceDueDate(febDate, 'Monthly', 31);
      expect(marDate).toBe('2026-03-31');

      // Advancing to April (30 days) -> clamped to 30
      const aprDate = advanceDueDate(marDate, 'Monthly', 31);
      expect(aprDate).toBe('2026-04-30');

      // Advancing to May (31 days) -> restored to 31
      const mayDate = advanceDueDate(aprDate, 'Monthly', 31);
      expect(mayDate).toBe('2026-05-31');
    });

    it('handles January 31 -> February (leap year 2028) -> March preserving 31st', () => {
      // 2028 is a leap year (February has 29 days)
      const janDate = '2028-01-31';
      const febDate = advanceDueDate(janDate, 'Monthly', 31);
      expect(febDate).toBe('2028-02-29');

      const marDate = advanceDueDate(febDate, 'Monthly', 31);
      expect(marDate).toBe('2028-03-31');
    });

    it('handles 30th day payment across February (2026-01-30 -> 2026-02-28 -> 2026-03-30)', () => {
      const janDate = '2026-01-30';
      const febDate = advanceDueDate(janDate, 'Monthly', 30);
      expect(febDate).toBe('2026-02-28');

      const marDate = advanceDueDate(febDate, 'Monthly', 30);
      expect(marDate).toBe('2026-03-30');
    });

    it('handles 29th day payment across non-leap February (2026-01-29 -> 2026-02-28 -> 2026-03-29)', () => {
      const janDate = '2026-01-29';
      const febDate = advanceDueDate(janDate, 'Monthly', 29);
      expect(febDate).toBe('2026-02-28');

      const marDate = advanceDueDate(febDate, 'Monthly', 29);
      expect(marDate).toBe('2026-03-29');
    });

    it('handles December to January year boundary with anchorDay', () => {
      const decDate = '2026-12-31';
      const nextDate = advanceDueDate(decDate, 'Monthly', 31);
      expect(nextDate).toBe('2027-01-31');
    });

    it('defaults anchorDay to current date day when not explicitly provided', () => {
      const date = '2026-01-15';
      const nextDate = advanceDueDate(date, 'Monthly');
      expect(nextDate).toBe('2026-02-15');
    });
  });

  describe('Yearly recurrence', () => {
    it('advances year for regular dates', () => {
      expect(advanceDueDate('2026-06-15', 'Yearly')).toBe('2027-06-15');
    });

    it('handles February 29 leap year to non-leap year with anchorDay 29', () => {
      // 2028 leap year Feb 29 -> 2029 non-leap Feb 28
      const feb2028 = '2028-02-29';
      const feb2029 = advanceDueDate(feb2028, 'Yearly', 29);
      expect(feb2029).toBe('2029-02-28');

      // Next year to 2030 with anchorDay 29
      const feb2030 = advanceDueDate(feb2029, 'Yearly', 29);
      expect(feb2030).toBe('2030-02-28');

      // Next leap year 2032 with anchorDay 29 -> restored to Feb 29
      const feb2031 = '2031-02-28';
      const feb2032 = advanceDueDate(feb2031, 'Yearly', 29);
      expect(feb2032).toBe('2032-02-29');
    });
  });

  describe('Daily and Weekly recurrences', () => {
    it('advances daily by exactly 1 calendar day across month boundary', () => {
      expect(advanceDueDate('2026-01-31', 'Daily')).toBe('2026-02-01');
      expect(advanceDueDate('2026-02-28', 'Daily')).toBe('2026-03-01');
    });

    it('advances weekly by exactly 7 calendar days across month boundary', () => {
      expect(advanceDueDate('2026-01-28', 'Weekly')).toBe('2026-02-04');
    });

    it('leaves One-time date unchanged', () => {
      expect(advanceDueDate('2026-10-15', 'One-time')).toBe('2026-10-15');
    });
  });

  describe('DEF-01: Recurring payment anchor-day correction & regression tests', () => {
    const basePayment: RecurringPayment = {
      id: 'rec-001',
      name: 'Internet Bill',
      amountInPaise: 100000,
      category: 'Bills',
      paymentMethod: 'UPI',
      frequency: 'Monthly',
      nextDueDate: '2026-01-31',
      anchorDay: 31,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('derives anchorDay from newly selected date when due date is edited (Jan 31 -> Feb 15 -> Mar 15)', async () => {
      const { db } = await import('../db/db');
      vi.mocked(db.recurringPayments.get).mockResolvedValueOnce(basePayment);

      // User edits next due date from Jan 31 to Feb 15
      const updated = await recurringPaymentRepository.updateRecurringPayment({
        ...basePayment,
        nextDueDate: '2026-02-15',
      });

      // Anchor day must now be 15, not stale 31
      expect(updated.anchorDay).toBe(15);
      expect(updated.nextDueDate).toBe('2026-02-15');

      // Next monthly due date advances to March 15
      const nextMonthDueDate = advanceDueDate(updated.nextDueDate, 'Monthly', updated.anchorDay);
      expect(nextMonthDueDate).toBe('2026-03-15');
    });

    it('preserves anchorDay 31 when due date is clamped to Feb 28 and advances to Mar 31', async () => {
      // 1. Advance Jan 31 monthly payment with anchor 31 to Feb
      const febDate = advanceDueDate('2026-01-31', 'Monthly', 31);
      expect(febDate).toBe('2026-02-28');

      // 2. Next monthly due date advances to March 31 preserving anchor 31
      const marDate = advanceDueDate(febDate, 'Monthly', 31);
      expect(marDate).toBe('2026-03-31');

      // 3. If a non-date edit occurs on Feb 28 payment (e.g. amount change), anchorDay 31 is preserved
      const { db } = await import('../db/db');
      const febPayment: RecurringPayment = {
        ...basePayment,
        nextDueDate: '2026-02-28',
        anchorDay: 31,
      };
      vi.mocked(db.recurringPayments.get).mockResolvedValueOnce(febPayment);

      const nonDateEdit = await recurringPaymentRepository.updateRecurringPayment({
        ...febPayment,
        amountInPaise: 120000, // changed amount only
      });
      expect(nonDateEdit.anchorDay).toBe(31);
      const nextDueAfterEdit = advanceDueDate(nonDateEdit.nextDueDate, 'Monthly', nonDateEdit.anchorDay);
      expect(nextDueAfterEdit).toBe('2026-03-31');
    });

    it('handles leap-year and non-leap-year month-end behavior accurately', async () => {
      const { db } = await import('../db/db');

      // Non-leap year 2026: Jan 31 -> Feb 28 -> Mar 31
      const nonLeapFeb = advanceDueDate('2026-01-31', 'Monthly', 31);
      expect(nonLeapFeb).toBe('2026-02-28');
      expect(advanceDueDate(nonLeapFeb, 'Monthly', 31)).toBe('2026-03-31');

      // Non-leap year explicit date edit to Feb 28 -> anchor becomes 28 -> Mar 28
      vi.mocked(db.recurringPayments.get).mockResolvedValueOnce(basePayment);
      const editedToFeb28 = await recurringPaymentRepository.updateRecurringPayment({
        ...basePayment,
        nextDueDate: '2026-02-28',
      });
      expect(editedToFeb28.anchorDay).toBe(28);
      expect(advanceDueDate(editedToFeb28.nextDueDate, 'Monthly', editedToFeb28.anchorDay)).toBe('2026-03-28');

      // Leap year 2028: Jan 31 -> Feb 29 -> Mar 31
      const leapFeb = advanceDueDate('2028-01-31', 'Monthly', 31);
      expect(leapFeb).toBe('2028-02-29');
      expect(advanceDueDate(leapFeb, 'Monthly', 31)).toBe('2028-03-31');

      // Leap year explicit date edit to Feb 29 -> anchor becomes 29 -> Mar 29
      const leapBasePayment: RecurringPayment = {
        ...basePayment,
        nextDueDate: '2028-01-31',
        anchorDay: 31,
      };
      vi.mocked(db.recurringPayments.get).mockResolvedValueOnce(leapBasePayment);
      const editedToFeb29 = await recurringPaymentRepository.updateRecurringPayment({
        ...leapBasePayment,
        nextDueDate: '2028-02-29',
      });
      expect(editedToFeb29.anchorDay).toBe(29);
      expect(advanceDueDate(editedToFeb29.nextDueDate, 'Monthly', editedToFeb29.anchorDay)).toBe('2028-03-29');
    });

    it('rejects invalid due dates on update and add', async () => {
      const { db } = await import('../db/db');
      vi.mocked(db.recurringPayments.get).mockResolvedValue(basePayment);

      // Impossible February dates
      await expect(
        recurringPaymentRepository.updateRecurringPayment({
          ...basePayment,
          nextDueDate: '2026-02-30',
        })
      ).rejects.toThrow(/Invalid calendar date/);

      await expect(
        recurringPaymentRepository.updateRecurringPayment({
          ...basePayment,
          nextDueDate: '2026-02-31',
        })
      ).rejects.toThrow(/Invalid calendar date/);

      // Non-leap year Feb 29
      await expect(
        recurringPaymentRepository.updateRecurringPayment({
          ...basePayment,
          nextDueDate: '2025-02-29',
        })
      ).rejects.toThrow(/Invalid calendar date/);

      // 31st on a 30-day month
      await expect(
        recurringPaymentRepository.updateRecurringPayment({
          ...basePayment,
          nextDueDate: '2026-04-31',
        })
      ).rejects.toThrow(/Invalid calendar date/);

      // Malformed date strings
      await expect(
        recurringPaymentRepository.updateRecurringPayment({
          ...basePayment,
          nextDueDate: 'not-a-date',
        })
      ).rejects.toThrow();

      await expect(
        recurringPaymentRepository.addRecurringPayment({
          name: 'Invalid Test',
          amountInPaise: 50000,
          category: 'Bills',
          paymentMethod: 'UPI',
          frequency: 'Monthly',
          nextDueDate: '2026-02-31',
        })
      ).rejects.toThrow(/Invalid calendar date/);
    });
  });
});
