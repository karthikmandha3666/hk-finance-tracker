import { db } from '../db/db';
import { PaymentMethod } from '../types';
import { generateUUID } from '../utils/uuid';

export const DEFAULT_PAYMENT_METHODS: string[] = [
  'Cash',
  'UPI',
  'Debit Card',
  'Credit Card',
  'Bank Transfer',
];

const MAX_PAYMENT_METHOD_NAME_LENGTH = 50;

let paymentMethodSeedingPromise: Promise<void> | null = null;

function validatePaymentMethodName(name: string): string {
  if (typeof name !== 'string') {
    throw new Error('Payment method name must be a valid text string.');
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('Payment method name cannot be empty.');
  }
  if (trimmed.length > MAX_PAYMENT_METHOD_NAME_LENGTH) {
    throw new Error(`Payment method name cannot exceed ${MAX_PAYMENT_METHOD_NAME_LENGTH} characters.`);
  }
  return trimmed;
}

export const paymentMethodRepository = {
  /**
   * Idempotently seeds default payment methods if none exist in the database.
   */
  async ensureDefaults(): Promise<void> {
    if (paymentMethodSeedingPromise) {
      return paymentMethodSeedingPromise;
    }

    paymentMethodSeedingPromise = (async () => {
      try {
        const count = await db.paymentMethods.count();
        if (count === 0) {
          const now = new Date().toISOString();
          const initialMethods: PaymentMethod[] = DEFAULT_PAYMENT_METHODS.map((methodName) => ({
            id: generateUUID(),
            name: methodName,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          }));
          await db.paymentMethods.bulkAdd(initialMethods);
        }
      } catch (err) {
        paymentMethodSeedingPromise = null;
        throw err;
      }
    })();

    return paymentMethodSeedingPromise;
  },

  /**
   * Retrieves all payment methods (both active and inactive).
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return db.paymentMethods.toArray();
  },

  /**
   * Retrieves only active payment methods.
   */
  async getActivePaymentMethods(): Promise<PaymentMethod[]> {
    const all = await db.paymentMethods.toArray();
    return all.filter((m) => m.isActive);
  },

  /**
   * Adds a new payment method.
   * Throws if name is empty, exceeds max length, or already exists case-insensitively.
   */
  async addPaymentMethod(name: string): Promise<PaymentMethod> {
    await this.ensureDefaults();
    const trimmed = validatePaymentMethodName(name);

    const all = await db.paymentMethods.toArray();
    const duplicate = all.find(
      (m) => m.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Payment method "${trimmed}" already exists.`);
    }

    const now = new Date().toISOString();
    const newMethod: PaymentMethod = {
      id: generateUUID(),
      name: trimmed,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.paymentMethods.add(newMethod);
    return newMethod;
  },

  /**
   * Renames an existing payment method.
   * Throws if not found or if the new name clashes case-insensitively with another payment method.
   */
  async updatePaymentMethod(id: string, name: string): Promise<PaymentMethod> {
    await this.ensureDefaults();
    const trimmed = validatePaymentMethodName(name);

    const existing = await db.paymentMethods.get(id);
    if (!existing) {
      throw new Error(`Payment method with ID ${id} not found.`);
    }

    const all = await db.paymentMethods.toArray();
    const duplicate = all.find(
      (m) => m.id !== id && m.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`A payment method named "${trimmed}" already exists.`);
    }

    const now = new Date().toISOString();
    const updated: PaymentMethod = {
      ...existing,
      name: trimmed,
      updatedAt: now,
    };

    await db.paymentMethods.put(updated);
    return updated;
  },

  /**
   * Deactivates a payment method (soft delete to preserve historical integrity).
   */
  async deactivatePaymentMethod(id: string): Promise<void> {
    await this.ensureDefaults();
    const existing = await db.paymentMethods.get(id);
    if (!existing) {
      throw new Error(`Payment method with ID ${id} not found.`);
    }

    await db.paymentMethods.update(id, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Reactivates a previously deactivated payment method.
   */
  async reactivatePaymentMethod(id: string): Promise<void> {
    await this.ensureDefaults();
    const existing = await db.paymentMethods.get(id);
    if (!existing) {
      throw new Error(`Payment method with ID ${id} not found.`);
    }

    await db.paymentMethods.update(id, {
      isActive: true,
      updatedAt: new Date().toISOString(),
    });
  },
};
