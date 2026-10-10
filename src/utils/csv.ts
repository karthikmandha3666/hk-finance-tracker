import type { Expense } from '../types';
import { rupeesToPaise, isValidCalendarDate } from './finance';
import { generateUUID } from './uuid';
import { db } from '../db/db';

export interface ParsedCsvExpense {
  date: string;
  amountInPaise: number;
  category: string;
  paymentMethod: string;
  note: string;
  rowNumber: number;
}

export interface CsvRowError {
  rowNumber: number;
  rawRow: string;
  reason: string;
}

export interface CsvParseResult {
  validRows: ParsedCsvExpense[];
  errors: CsvRowError[];
  totalRows: number;
}

export interface DuplicateDetectionResult {
  uniqueRows: ParsedCsvExpense[];
  duplicateRows: ParsedCsvExpense[];
}

/**
 * Escapes a single string field according to RFC-4180 rules.
 * If the value contains commas, quotes, or newlines, wraps in quotes and doubles inner quotes.
 */
export function escapeCsvField(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports a list of Expense objects into an RFC-4180 CSV string.
 * Prepend UTF-8 BOM (\uFEFF) to guarantee Excel cleanly renders currency and special characters.
 */
export function exportExpensesToCsv(expenses: Expense[]): string {
  const header = ['Date', 'Amount (INR)', 'Category', 'Payment Method', 'Note'];
  const lines: string[] = [header.map(escapeCsvField).join(',')];

  // Sort descending by date, then by creation time
  const sorted = [...expenses].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  for (const exp of sorted) {
    const rupees = (exp.amountInPaise / 100).toFixed(2);
    const row = [
      exp.date,
      rupees,
      exp.category,
      exp.paymentMethod,
      exp.note || '',
    ];
    lines.push(row.map(escapeCsvField).join(','));
  }

  // Prepend UTF-8 BOM for Microsoft Excel compatibility
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Initiates a browser file download of CSV content.
 */
export function downloadCsvFile(csvContent: string, filename?: string): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const name = filename || `spendly-expenses-${dateStr}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * RFC-4180 compliant CSV parser that correctly handles:
 * - Quoted fields with commas, newlines, and escaped quotes ("")
 * - Unquoted fields
 * - CRLF and LF newlines
 * - Optional UTF-8 BOM
 */
export function parseRawCsvLines(csvText: string): string[][] {
  const cleanText = csvText.startsWith('\uFEFF') ? csvText.slice(1) : csvText;
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++; // Handle CRLF
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Push last field & row if anything remains
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((r) => r.some((field) => field.trim().length > 0));
}

/**
 * Parses and validates an uploaded Spendly CSV file.
 * Required columns: Date, Amount (or Amount (INR)), Category, Payment Method.
 * Optional column: Note.
 */
export function parseExpensesCsv(csvText: string): CsvParseResult {
  const rawRows = parseRawCsvLines(csvText);
  if (rawRows.length === 0) {
    return { validRows: [], errors: [{ rowNumber: 1, rawRow: '', reason: 'CSV file is empty.' }], totalRows: 0 };
  }

  const headerRow = rawRows[0].map((h) => h.trim().toLowerCase());
  
  // Resolve column indexes with flexible header aliases
  const dateIdx = headerRow.findIndex((h) => h === 'date' || h === 'expense date');
  const amountIdx = headerRow.findIndex(
    (h) => h === 'amount' || h === 'amount (inr)' || h === 'amount (rs)' || h === 'amount in inr' || h === 'rupees'
  );
  const categoryIdx = headerRow.findIndex((h) => h === 'category');
  const paymentIdx = headerRow.findIndex(
    (h) => h === 'payment method' || h === 'payment' || h === 'method' || h === 'payment_method'
  );
  const noteIdx = headerRow.findIndex((h) => h === 'note' || h === 'notes' || h === 'description');

  const missingColumns: string[] = [];
  if (dateIdx === -1) missingColumns.push('Date');
  if (amountIdx === -1) missingColumns.push('Amount');
  if (categoryIdx === -1) missingColumns.push('Category');
  if (paymentIdx === -1) missingColumns.push('Payment Method');

  if (missingColumns.length > 0) {
    return {
      validRows: [],
      errors: [
        {
          rowNumber: 1,
          rawRow: rawRows[0].join(','),
          reason: `Missing required column headers: ${missingColumns.join(', ')}. Expected headers: Date, Amount, Category, Payment Method, Note.`,
        },
      ],
      totalRows: rawRows.length - 1,
    };
  }

  const validRows: ParsedCsvExpense[] = [];
  const errors: CsvRowError[] = [];
  const dataRows = rawRows.slice(1);

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2; // 1-based, accounting for header row
    const rawLine = row.join(',');

    const rawDate = (row[dateIdx] ?? '').trim();
    const rawAmount = (row[amountIdx] ?? '').trim().replace(/[₹,\s]/g, '');
    const rawCategory = (row[categoryIdx] ?? '').trim();
    const rawPayment = (row[paymentIdx] ?? '').trim();
    const rawNote = noteIdx !== -1 ? (row[noteIdx] ?? '').trim() : '';

    // Validate Date
    if (!rawDate) {
      errors.push({ rowNumber, rawRow: rawLine, reason: 'Date is empty.' });
      return;
    }
    if (!isValidCalendarDate(rawDate)) {
      errors.push({
        rowNumber,
        rawRow: rawLine,
        reason: `Invalid date format "${rawDate}". Must be YYYY-MM-DD (e.g. 2026-10-15).`,
      });
      return;
    }

    // Validate Amount
    if (!rawAmount) {
      errors.push({ rowNumber, rawRow: rawLine, reason: 'Amount is empty.' });
      return;
    }
    const parsedPaise = rupeesToPaise(rawAmount);
    if (isNaN(parsedPaise) || parsedPaise <= 0) {
      errors.push({
        rowNumber,
        rawRow: rawLine,
        reason: `Invalid amount "${rawAmount}". Must be a positive number greater than ₹0.00.`,
      });
      return;
    }
    if (parsedPaise > 100000000) { // ₹10,00,000 maximum per transaction
      errors.push({
        rowNumber,
        rawRow: rawLine,
        reason: `Amount exceeds maximum allowed limit of ₹10,00,000.`,
      });
      return;
    }

    // Validate Category
    if (!rawCategory) {
      errors.push({ rowNumber, rawRow: rawLine, reason: 'Category cannot be empty.' });
      return;
    }

    // Validate Payment Method
    if (!rawPayment) {
      errors.push({ rowNumber, rawRow: rawLine, reason: 'Payment Method cannot be empty.' });
      return;
    }

    validRows.push({
      date: rawDate,
      amountInPaise: parsedPaise,
      category: rawCategory,
      paymentMethod: rawPayment,
      note: rawNote,
      rowNumber,
    });
  });

  return {
    validRows,
    errors,
    totalRows: dataRows.length,
  };
}

/**
 * Checks parsed import rows against existing expenses in the database to detect potential duplicates.
 * Matches on Date, Amount, Category, Payment Method, and Note.
 */
export function detectDuplicateExpenses(
  importRows: ParsedCsvExpense[],
  existingExpenses: Expense[]
): DuplicateDetectionResult {
  const existingSet = new Set<string>();
  existingExpenses.forEach((exp) => {
    const key = `${exp.date}|${exp.amountInPaise}|${exp.category.trim().toLowerCase()}|${exp.paymentMethod.trim().toLowerCase()}|${(exp.note || '').trim().toLowerCase()}`;
    existingSet.add(key);
  });

  const uniqueRows: ParsedCsvExpense[] = [];
  const duplicateRows: ParsedCsvExpense[] = [];

  importRows.forEach((row) => {
    const key = `${row.date}|${row.amountInPaise}|${row.category.trim().toLowerCase()}|${row.paymentMethod.trim().toLowerCase()}|${row.note.trim().toLowerCase()}`;
    if (existingSet.has(key)) {
      duplicateRows.push(row);
    } else {
      uniqueRows.push(row);
    }
  });

  return { uniqueRows, duplicateRows };
}

/**
 * Atomically inserts imported expenses into IndexedDB.
 * Also ensures any new categories or payment methods are registered so they appear in filters/dropdowns.
 */
export async function importExpensesToDatabase(
  rowsToImport: ParsedCsvExpense[],
  targetDb = db
): Promise<{ importedCount: number }> {
  if (rowsToImport.length === 0) {
    return { importedCount: 0 };
  }

  const nowIso = new Date().toISOString();

  const newExpenses: Expense[] = rowsToImport.map((row) => ({
    id: generateUUID(),
    amountInPaise: row.amountInPaise,
    category: row.category,
    paymentMethod: row.paymentMethod,
    date: row.date,
    note: row.note,
    currency: 'INR',
    createdAt: nowIso,
    updatedAt: nowIso,
  }));

  await targetDb.transaction('rw', [targetDb.expenses, targetDb.categories, targetDb.paymentMethods], async () => {
    // 1. Bulk add expenses
    await targetDb.expenses.bulkAdd(newExpenses);

    // 2. Register any unseen categories
    const existingCats = await targetDb.categories.toArray();
    const existingCatNames = new Set(existingCats.map((c) => c.name.trim().toLowerCase()));
    const uniqueNewCats = new Set<string>();
    rowsToImport.forEach((r) => {
      const norm = r.category.trim().toLowerCase();
      if (!existingCatNames.has(norm) && !uniqueNewCats.has(norm)) {
        uniqueNewCats.add(norm);
      }
    });

    if (uniqueNewCats.size > 0) {
      const catsToAdd = Array.from(uniqueNewCats).map((name) => {
        // Capitalize words neatly
        const formatted = name
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        return {
          id: generateUUID(),
          name: formatted,
          isActive: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      });
      await targetDb.categories.bulkAdd(catsToAdd);
    }

    // 3. Register any unseen payment methods
    const existingMethods = await targetDb.paymentMethods.toArray();
    const existingMethodNames = new Set(existingMethods.map((m) => m.name.trim().toLowerCase()));
    const uniqueNewMethods = new Set<string>();
    rowsToImport.forEach((r) => {
      const norm = r.paymentMethod.trim().toLowerCase();
      if (!existingMethodNames.has(norm) && !uniqueNewMethods.has(norm)) {
        uniqueNewMethods.add(norm);
      }
    });

    if (uniqueNewMethods.size > 0) {
      const methodsToAdd = Array.from(uniqueNewMethods).map((name) => {
        const formatted = name
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        return {
          id: generateUUID(),
          name: formatted,
          isActive: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      });
      await targetDb.paymentMethods.bulkAdd(methodsToAdd);
    }
  });

  return { importedCount: newExpenses.length };
}
