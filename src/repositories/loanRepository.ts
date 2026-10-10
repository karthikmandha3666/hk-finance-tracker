import { db } from '../db/db';
import { Loan, LoanType } from '../types';
import { generateUUID } from '../utils/uuid';

export interface CreateLoanInput {
  name: string;
  loanType: LoanType | string;
  principalAmountInPaise: number;
  outstandingAmountInPaise: number;
  interestRatePercent: number;
  emiAmountInPaise: number;
  dueDay: number;
  remainingTenureMonths: number;
  startDate: string;
  isActive?: boolean;
  note?: string;
}

const MAX_NAME_LENGTH = 50;
const MAX_NOTE_LENGTH = 120;
const MAX_PRINCIPAL_PAISE = 10000000000; // ₹10,00,00,000 (10 crore)
const MAX_EMI_PAISE = 100000000; // ₹10,00,000

export const validateLoanInput = (
  data: Pick<
    Loan,
    | 'name'
    | 'loanType'
    | 'principalAmountInPaise'
    | 'outstandingAmountInPaise'
    | 'interestRatePercent'
    | 'emiAmountInPaise'
    | 'dueDay'
    | 'remainingTenureMonths'
    | 'startDate'
  > & { note?: string }
): void => {
  const trimmedName = data.name ? data.name.trim() : '';
  if (!trimmedName) {
    throw new Error('Loan name is required.');
  }
  if (trimmedName.length > MAX_NAME_LENGTH) {
    throw new Error(`Loan name cannot exceed ${MAX_NAME_LENGTH} characters.`);
  }

  const trimmedType = data.loanType ? data.loanType.trim() : '';
  if (!trimmedType) {
    throw new Error('Loan type is required.');
  }

  if (
    !Number.isInteger(data.principalAmountInPaise) ||
    data.principalAmountInPaise <= 0
  ) {
    throw new Error('Principal amount must be a positive integer in paise.');
  }
  if (data.principalAmountInPaise > MAX_PRINCIPAL_PAISE) {
    throw new Error('Principal amount exceeds maximum allowed limit.');
  }

  if (
    !Number.isInteger(data.outstandingAmountInPaise) ||
    data.outstandingAmountInPaise < 0
  ) {
    throw new Error('Outstanding amount must be non-negative in paise.');
  }
  if (data.outstandingAmountInPaise > data.principalAmountInPaise) {
    throw new Error('Outstanding balance cannot exceed original principal amount.');
  }

  if (
    typeof data.interestRatePercent !== 'number' ||
    isNaN(data.interestRatePercent) ||
    data.interestRatePercent < 0 ||
    data.interestRatePercent > 100
  ) {
    throw new Error('Interest rate must be between 0% and 100%.');
  }

  if (
    !Number.isInteger(data.emiAmountInPaise) ||
    data.emiAmountInPaise <= 0
  ) {
    throw new Error('EMI amount must be a positive integer in paise.');
  }
  if (data.emiAmountInPaise > MAX_EMI_PAISE) {
    throw new Error('EMI amount exceeds maximum allowed limit.');
  }

  if (
    !Number.isInteger(data.dueDay) ||
    data.dueDay < 1 ||
    data.dueDay > 31
  ) {
    throw new Error('Due day must be an integer between 1 and 31.');
  }

  if (
    !Number.isInteger(data.remainingTenureMonths) ||
    data.remainingTenureMonths < 0
  ) {
    throw new Error('Remaining tenure must be an integer >= 0.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startDate)) {
    throw new Error('Please select a valid start date (YYYY-MM-DD).');
  }
  const [y, m, d] = data.startDate.split('-').map(Number);
  const testDate = new Date(y, m - 1, d);
  if (
    testDate.getFullYear() !== y ||
    testDate.getMonth() !== m - 1 ||
    testDate.getDate() !== d
  ) {
    throw new Error('Start date is not a valid calendar date.');
  }

  if (data.note && data.note.trim().length > MAX_NOTE_LENGTH) {
    throw new Error(`Note cannot exceed ${MAX_NOTE_LENGTH} characters.`);
  }
};

export const loanRepository = {
  /**
   * Retrieves all loans sorted descending by createdAt.
   */
  async getLoans(): Promise<Loan[]> {
    const list = await db.loans.toArray();
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /**
   * Retrieves all active loans sorted by dueDay ascending, then name.
   */
  async getActiveLoans(): Promise<Loan[]> {
    const list = await db.loans.filter((l) => l.isActive).toArray();
    return list.sort((a, b) => {
      if (a.dueDay !== b.dueDay) return a.dueDay - b.dueDay;
      return a.name.localeCompare(b.name);
    });
  },

  /**
   * Retrieves all inactive / closed loans sorted by updatedAt descending.
   */
  async getInactiveLoans(): Promise<Loan[]> {
    const list = await db.loans.filter((l) => !l.isActive).toArray();
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  /**
   * Retrieves a single loan by its ID.
   */
  async getLoanById(id: string): Promise<Loan | undefined> {
    return db.loans.get(id);
  },

  /**
   * Adds a new validated loan.
   */
  async addLoan(data: CreateLoanInput): Promise<Loan> {
    validateLoanInput(data);

    const now = new Date().toISOString();
    const newRecord: Loan = {
      id: generateUUID(),
      name: data.name.trim(),
      loanType: data.loanType.trim(),
      principalAmountInPaise: data.principalAmountInPaise,
      outstandingAmountInPaise: data.outstandingAmountInPaise,
      interestRatePercent: data.interestRatePercent,
      emiAmountInPaise: data.emiAmountInPaise,
      dueDay: data.dueDay,
      remainingTenureMonths: data.remainingTenureMonths,
      startDate: data.startDate.trim(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      note: data.note ? data.note.trim() : undefined,
      createdAt: now,
      updatedAt: now,
    };

    await db.loans.add(newRecord);
    return newRecord;
  },

  /**
   * Updates an existing loan, preserving id and createdAt.
   */
  async updateLoan(loan: Loan): Promise<Loan> {
    validateLoanInput(loan);

    const existing = await db.loans.get(loan.id);
    if (!existing) {
      throw new Error(`Loan with ID "${loan.id}" not found.`);
    }

    const updated: Loan = {
      ...loan,
      name: loan.name.trim(),
      loanType: loan.loanType.trim(),
      startDate: loan.startDate.trim(),
      note: loan.note ? loan.note.trim() : undefined,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await db.loans.put(updated);
    return updated;
  },

  /**
   * Updates only the outstanding balance of a loan.
   */
  async updateOutstandingBalance(
    id: string,
    newOutstandingInPaise: number
  ): Promise<Loan> {
    if (!Number.isInteger(newOutstandingInPaise) || newOutstandingInPaise < 0) {
      throw new Error('Outstanding balance must be a non-negative integer in paise.');
    }

    const existing = await db.loans.get(id);
    if (!existing) {
      throw new Error(`Loan with ID "${id}" not found.`);
    }

    if (newOutstandingInPaise > existing.principalAmountInPaise) {
      throw new Error('Outstanding balance cannot exceed original principal amount.');
    }

    const updated: Loan = {
      ...existing,
      outstandingAmountInPaise: newOutstandingInPaise,
      updatedAt: new Date().toISOString(),
    };

    await db.loans.put(updated);
    return updated;
  },

  /**
   * Deactivates a loan (marks it closed/inactive).
   */
  async deactivateLoan(id: string): Promise<Loan> {
    const existing = await db.loans.get(id);
    if (!existing) {
      throw new Error(`Loan with ID "${id}" not found.`);
    }

    const updated: Loan = {
      ...existing,
      isActive: false,
      updatedAt: new Date().toISOString(),
    };

    await db.loans.put(updated);
    return updated;
  },

  /**
   * Reactivates an inactive/closed loan.
   */
  async reactivateLoan(id: string): Promise<Loan> {
    const existing = await db.loans.get(id);
    if (!existing) {
      throw new Error(`Loan with ID "${id}" not found.`);
    }

    const updated: Loan = {
      ...existing,
      isActive: true,
      updatedAt: new Date().toISOString(),
    };

    await db.loans.put(updated);
    return updated;
  },

  /**
   * Permanently deletes a loan record by ID.
   */
  async deleteLoan(id: string): Promise<void> {
    const existing = await db.loans.get(id);
    if (!existing) {
      throw new Error(`Loan with ID "${id}" not found.`);
    }
    await db.loans.delete(id);
  },
};
