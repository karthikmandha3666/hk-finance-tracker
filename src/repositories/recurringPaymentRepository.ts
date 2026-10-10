import { db } from '../db/db';
import { RecurringPayment, RecurrenceFrequency } from '../types';
import {
  advanceDueDate,
  isValidCalendarDate,
  MAX_AMOUNT_PAISE,
} from '../utils/finance';
import { generateUUID } from '../utils/uuid';

const MAX_NAME_LENGTH = 50;
const MAX_NOTE_LENGTH = 120;
const VALID_FREQUENCIES: RecurrenceFrequency[] = ['One-time', 'Daily', 'Weekly', 'Monthly', 'Yearly'];

function validatePaymentInput(data: {
  name: string;
  amountInPaise: number;
  category: string;
  paymentMethod: string;
  frequency: RecurrenceFrequency;
  nextDueDate: string;
  note?: string;
}): void {
  if (typeof data.name !== 'string') {
    throw new Error('Payment name must be a text string.');
  }
  const trimmedName = data.name.trim();
  if (trimmedName.length === 0) {
    throw new Error('Payment name is required.');
  }
  if (trimmedName.length > MAX_NAME_LENGTH) {
    throw new Error(`Payment name cannot exceed ${MAX_NAME_LENGTH} characters.`);
  }

  if (typeof data.amountInPaise !== 'number' || !Number.isInteger(data.amountInPaise) || data.amountInPaise <= 0) {
    throw new Error('Amount must be a valid positive number greater than ₹0.');
  }
  if (data.amountInPaise > MAX_AMOUNT_PAISE) {
    throw new Error('Amount cannot exceed ₹10,00,000.');
  }

  if (typeof data.category !== 'string' || data.category.trim() === '') {
    throw new Error('Category is required.');
  }

  if (typeof data.paymentMethod !== 'string' || data.paymentMethod.trim() === '') {
    throw new Error('Payment method is required.');
  }

  if (!VALID_FREQUENCIES.includes(data.frequency)) {
    throw new Error(`Invalid frequency: ${data.frequency}`);
  }

  if (typeof data.nextDueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.nextDueDate.trim())) {
    throw new Error('Next due date must be a valid date in YYYY-MM-DD format.');
  }

  // Validate calendar date validity (e.g. reject 2026-02-31)
  if (!isValidCalendarDate(data.nextDueDate.trim())) {
    throw new Error(`Invalid calendar date: ${data.nextDueDate}`);
  }

  if (data.note && data.note.trim().length > MAX_NOTE_LENGTH) {
    throw new Error(`Note cannot exceed ${MAX_NOTE_LENGTH} characters.`);
  }
}

export const recurringPaymentRepository = {
  /**
   * Retrieves all recurring payments (both active and inactive).
   */
  async getRecurringPayments(): Promise<RecurringPayment[]> {
    return db.recurringPayments.toArray();
  },

  /**
   * Retrieves only active recurring payments.
   */
  async getActiveRecurringPayments(): Promise<RecurringPayment[]> {
    const all = await db.recurringPayments.toArray();
    return all.filter((p) => p.isActive);
  },

  /**
   * Retrieves active upcoming payments sorted chronologically by nextDueDate ascending.
   */
  async getUpcomingPayments(): Promise<RecurringPayment[]> {
    const active = await this.getActiveRecurringPayments();
    return active.sort((a, b) => {
      if (a.nextDueDate !== b.nextDueDate) {
        return a.nextDueDate.localeCompare(b.nextDueDate);
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
  },

  /**
   * Retrieves a recurring payment by unique ID.
   */
  async getRecurringPaymentById(id: string): Promise<RecurringPayment | undefined> {
    return db.recurringPayments.get(id);
  },

  /**
   * Adds a new validated recurring payment.
   */
  async addRecurringPayment(data: {
    name: string;
    amountInPaise: number;
    category: string;
    paymentMethod: string;
    frequency: RecurrenceFrequency;
    nextDueDate: string;
    anchorDay?: number;
    note?: string;
    isActive?: boolean;
  }): Promise<RecurringPayment> {
    validatePaymentInput(data);

    const now = new Date().toISOString();
    const parsedDay = parseInt(data.nextDueDate.trim().split('-')[2], 10);
    const anchorDay = (data.anchorDay !== undefined && data.anchorDay >= 1 && data.anchorDay <= 31)
      ? data.anchorDay
      : (isNaN(parsedDay) ? 1 : parsedDay);

    const newRecord: RecurringPayment = {
      id: generateUUID(),
      name: data.name.trim(),
      amountInPaise: data.amountInPaise,
      category: data.category.trim(),
      paymentMethod: data.paymentMethod.trim(),
      frequency: data.frequency,
      nextDueDate: data.nextDueDate.trim(),
      anchorDay,
      isActive: data.isActive !== undefined ? data.isActive : true,
      note: data.note ? data.note.trim() : undefined,
      createdAt: now,
      updatedAt: now,
    };

    await db.recurringPayments.add(newRecord);
    return newRecord;
  },

  /**
   * Updates an existing recurring payment, preserving original ID and createdAt.
   */
  async updateRecurringPayment(payment: RecurringPayment): Promise<RecurringPayment> {
    validatePaymentInput(payment);

    const existing = await db.recurringPayments.get(payment.id);
    if (!existing) {
      throw new Error(`Recurring payment with ID "${payment.id}" not found.`);
    }

    const isDateChanged = payment.nextDueDate.trim() !== existing.nextDueDate.trim();
    const parsedDay = parseInt(payment.nextDueDate.trim().split('-')[2], 10);
    const anchorDay = isDateChanged
      ? (isNaN(parsedDay) ? 1 : parsedDay)
      : (payment.anchorDay !== undefined
          ? payment.anchorDay
          : (existing.anchorDay !== undefined ? existing.anchorDay : (isNaN(parsedDay) ? 1 : parsedDay)));

    const updated: RecurringPayment = {
      ...payment,
      name: payment.name.trim(),
      category: payment.category.trim(),
      paymentMethod: payment.paymentMethod.trim(),
      nextDueDate: payment.nextDueDate.trim(),
      anchorDay,
      note: payment.note ? payment.note.trim() : undefined,
      createdAt: existing.createdAt, // strictly preserve original createdAt
      updatedAt: new Date().toISOString(),
    };

    await db.recurringPayments.put(updated);
    return updated;
  },

  /**
   * Deactivates a recurring payment (soft delete).
   */
  async deactivateRecurringPayment(id: string): Promise<RecurringPayment> {
    const existing = await db.recurringPayments.get(id);
    if (!existing) {
      throw new Error(`Recurring payment with ID "${id}" not found.`);
    }

    const updated: RecurringPayment = {
      ...existing,
      isActive: false,
      updatedAt: new Date().toISOString(),
    };
    await db.recurringPayments.put(updated);
    return updated;
  },

  /**
   * Reactivates an inactive recurring payment.
   */
  async reactivateRecurringPayment(id: string): Promise<RecurringPayment> {
    const existing = await db.recurringPayments.get(id);
    if (!existing) {
      throw new Error(`Recurring payment with ID "${id}" not found.`);
    }

    const updated: RecurringPayment = {
      ...existing,
      isActive: true,
      updatedAt: new Date().toISOString(),
    };
    await db.recurringPayments.put(updated);
    return updated;
  },

  /**
   * Permanently deletes a recurring payment record by ID.
   */
  async deleteRecurringPayment(id: string): Promise<void> {
    const existing = await db.recurringPayments.get(id);
    if (!existing) {
      throw new Error(`Recurring payment with ID "${id}" not found.`);
    }
    await db.recurringPayments.delete(id);
  },

  /**
   * Marks a payment as paid.
   * If frequency is 'One-time': marks completed/inactive.
   * If recurring: advances nextDueDate according to frequency.
   * Note: Does NOT automatically create an expense.
   *
   * Repository-level concurrency protection:
   * 1. In-flight operation lock map deduplicates concurrent calls within the same tab.
   * 2. Dexie 'rw' read-write transaction serializes operations across browser tabs.
   * 3. If expectedCurrentDueDate is passed, a stale second request does not advance again.
   */
  async markAsPaid(id: string, expectedCurrentDueDate?: string): Promise<RecurringPayment> {
    const activeOp = inFlightPaymentOperations.get(id);
    if (activeOp) {
      return activeOp;
    }

    const opPromise = (async () => {
      try {
        return await db.transaction('rw', db.recurringPayments, async () => {
          const existing = await db.recurringPayments.get(id);
          if (!existing) {
            throw new Error(`Recurring payment with ID "${id}" not found.`);
          }

          // Cross-tab / stale date check:
          // If expectedCurrentDueDate is specified and no longer matches, another tab already advanced it.
          if (expectedCurrentDueDate && existing.nextDueDate !== expectedCurrentDueDate) {
            return existing;
          }

          const now = new Date().toISOString();

          if (existing.frequency === 'One-time') {
            if (!existing.isActive) {
              return existing;
            }
            const updated: RecurringPayment = {
              ...existing,
              isActive: false,
              updatedAt: now,
            };
            await db.recurringPayments.put(updated);
            return updated;
          }

          // Recurring payment: advance next due date preserving anchorDay
          const existingDay = parseInt(existing.nextDueDate.split('-')[2], 10);
          const anchorDay = (existing.anchorDay !== undefined && existing.anchorDay >= 1 && existing.anchorDay <= 31)
            ? existing.anchorDay
            : (isNaN(existingDay) ? 1 : existingDay);

          const nextDate = advanceDueDate(existing.nextDueDate, existing.frequency, anchorDay);
          const updated: RecurringPayment = {
            ...existing,
            anchorDay,
            nextDueDate: nextDate,
            updatedAt: now,
          };

          await db.recurringPayments.put(updated);
          return updated;
        });
      } finally {
        inFlightPaymentOperations.delete(id);
      }
    })();

    inFlightPaymentOperations.set(id, opPromise);
    return opPromise;
  },
};

// In-flight operation lock map to deduplicate concurrent calls for the same payment ID
const inFlightPaymentOperations = new Map<string, Promise<RecurringPayment>>();
