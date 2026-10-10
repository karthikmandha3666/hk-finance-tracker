import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Expense } from '../types';
import { expenseRepository } from '../repositories/expenseRepository';
import { categoryRepository, sortCategoriesDeterministic } from '../repositories/categoryRepository';
import { paymentMethodRepository } from '../repositories/paymentMethodRepository';
import {
  rupeesToPaise,
  formatPaiseToRupees,
  paiseToRupeesInput,
  MAX_AMOUNT_RUPEES,
  MAX_AMOUNT_PAISE,
  isValidCalendarDate,
} from '../utils/finance';

interface EditExpenseViewProps {
  expense: Expense;
  onCancel: () => void;
  onExpenseUpdated?: (updatedExpense?: Expense) => void;
  onExpenseDeleted?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const EditExpenseView: React.FC<EditExpenseViewProps> = ({
  expense,
  onCancel,
  onExpenseUpdated,
  onExpenseDeleted,
  onDirtyChange,
}) => {
  // Live queries for active categories and payment methods
  const activeCategories = useLiveQuery(() => categoryRepository.getActiveCategories()) ?? [];
  const activePaymentMethods = useLiveQuery(() => paymentMethodRepository.getActivePaymentMethods()) ?? [];

  // Build category choices: active categories + historical expense category if inactive/missing
  const categoryOptions = useMemo(() => {
    const options = activeCategories.map((c) => ({
      id: c.id,
      name: c.name,
      isInactive: false,
    }));
    const hasExisting = options.some((opt) => opt.name === expense.category);
    if (!hasExisting && expense.category) {
      options.push({
        id: '__historical_cat__',
        name: expense.category,
        isInactive: true,
      });
    }
    return sortCategoriesDeterministic(options);
  }, [activeCategories, expense.category]);

  // Build payment method choices: active payment methods + historical method if inactive/missing
  const paymentMethodOptions = useMemo(() => {
    const options = activePaymentMethods.map((m) => ({
      id: m.id,
      name: m.name,
      isInactive: false,
    }));
    const hasExisting = options.some((opt) => opt.name === expense.paymentMethod);
    if (!hasExisting && expense.paymentMethod) {
      options.push({
        id: '__historical_pm__',
        name: expense.paymentMethod,
        isInactive: true,
      });
    }
    return options;
  }, [activePaymentMethods, expense.paymentMethod]);

  // Pre-fill existing expense fields
  const [amount, setAmount] = useState<string>(() => paiseToRupeesInput(expense.amountInPaise));
  const [amountError, setAmountError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>(expense.category);
  const [selectedPayment, setSelectedPayment] = useState<string>(expense.paymentMethod);
  const [date, setDate] = useState<string>(expense.date);
  const [dateError, setDateError] = useState<string | null>(null);
  const [note, setNote] = useState<string>(expense.note || '');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const initialAmount = useMemo(() => paiseToRupeesInput(expense.amountInPaise), [expense.amountInPaise]);

  useEffect(() => {
    const isDirty =
      amount !== initialAmount ||
      note !== (expense.note || '') ||
      date !== expense.date ||
      selectedCategory !== expense.category ||
      selectedPayment !== expense.paymentMethod;
    onDirtyChange?.(isDirty);
    return () => {
      onDirtyChange?.(false);
    };
  }, [
    amount,
    initialAmount,
    note,
    expense.note,
    date,
    expense.date,
    selectedCategory,
    expense.category,
    selectedPayment,
    expense.paymentMethod,
    onDirtyChange,
  ]);

  const handleDateChange = (val: string) => {
    setDate(val);
    if (!val.trim()) {
      setDateError('Date is required.');
    } else if (!isValidCalendarDate(val)) {
      setDateError('Please enter a valid calendar date in YYYY-MM-DD format.');
    } else {
      setDateError(null);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // 1. Allow completely empty string (backspacing all the way to empty)
    if (raw === '') {
      setAmount('');
      setAmountError(null);
      return;
    }

    // 2. Allow only valid numbers with at most one decimal point and up to 2 decimal places
    if (!/^\d*(\.\d{0,2})?$/.test(raw)) {
      e.target.value = amount;
      return;
    }

    // 3. Prevent multiple leading zeros (e.g. '00', '000', '000000')
    if (raw === '00' || /^00+/.test(raw)) {
      e.target.value = amount;
      return;
    }

    // 4. If current value was '0' and user types a non-zero digit 1-9 (e.g. '05'),
    // replace the leading '0' with the new digit ('5')
    if (raw.length > 1 && raw.startsWith('0') && raw[1] !== '.') {
      raw = raw.replace(/^0+/, '');
      if (raw === '') raw = '0';
    }

    // 5. Hard ceiling on integer digits: MAX_AMOUNT (10,00,000) has 7 digits
    const integerPart = raw.split('.')[0] || '';
    if (integerPart.length > 7) {
      setAmountError('Maximum amount is ₹10,00,000');
      e.target.value = amount;
      return;
    }

    // 6. Maximum amount enforcement: ₹10,00,000 (10 lakh)
    const numVal = parseFloat(raw);
    if (!isNaN(numVal) && numVal > MAX_AMOUNT_RUPEES) {
      setAmountError('Maximum amount is ₹10,00,000');
      e.target.value = amount;
      return;
    }

    // 7. Enforce: Do not accept only 0 (an expense must be greater than ₹0)
    if (!isNaN(numVal) && numVal === 0 && !raw.endsWith('.')) {
      setAmountError('Amount must be greater than ₹0');
    } else {
      setAmountError(null);
    }

    setAmount(raw);
  };

  const amountPaise = rupeesToPaise(amount);
  const isFormValid =
    amount.trim() !== '' &&
    amountError === null &&
    amountPaise > 0 &&
    amountPaise <= MAX_AMOUNT_PAISE &&
    date.trim() !== '' &&
    dateError === null &&
    isValidCalendarDate(date) &&
    selectedCategory.trim() !== '' &&
    selectedPayment.trim() !== '';

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (!isValidCalendarDate(date)) {
      setDateError('Please enter a valid calendar date in YYYY-MM-DD format.');
      return;
    }
    if (!isFormValid || isSaving || isDeleting) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const trimmedNote = note.trim().slice(0, 120);

      const updatedExpense: Expense = {
        id: expense.id, // Strictly preserve existing ID
        amountInPaise: amountPaise,
        category: selectedCategory,
        paymentMethod: selectedPayment,
        date: date.trim(),
        note: trimmedNote,
        currency: 'INR',
        createdAt: expense.createdAt, // Strictly preserve original createdAt
        updatedAt: new Date().toISOString(), // Update updatedAt timestamp
      };

      await expenseRepository.updateExpense(updatedExpense);

      // Mark form clean synchronously before notifying parent
      onDirtyChange?.(false);

      if (onExpenseUpdated) {
        onExpenseUpdated(updatedExpense);
      } else {
        onCancel();
      }
    } catch (err) {
      console.error('Failed to update expense in IndexedDB:', err);
      setSaveError('Unable to update expense. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (isDeleting || isSaving) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await expenseRepository.deleteExpense(expense.id);
      setShowDeleteConfirm(false);

      // Mark form clean synchronously before notifying parent
      onDirtyChange?.(false);

      if (onExpenseDeleted) {
        onExpenseDeleted();
      } else {
        onCancel();
      }
    } catch (err) {
      console.error('Failed to delete expense from IndexedDB:', err);
      setDeleteError('Unable to delete expense. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    if (isSaving || isDeleting) return;
    onCancel();
  };

  return (
    <div className="add-expense-view">
      {/* View Header */}
      <div className="view-header">
        <button
          type="button"
          className="btn-icon-back"
          onClick={handleCancel}
          aria-label="Back to Home"
          disabled={isSaving || isDeleting}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <h2 className="view-title">Edit Expense</h2>

        <button
          type="button"
          className="btn-icon-delete"
          onClick={() => setShowDeleteConfirm(true)}
          aria-label="Delete Expense"
          title="Delete Expense"
          disabled={isSaving || isDeleting}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>

      <form className="add-expense-form" onSubmit={handleSubmit}>
        {/* Prominent Amount Input Card */}
        <div className={`amount-input-card ${amountError ? 'has-error' : ''}`}>
          <label htmlFor="expense-amount" className="form-label text-center">Amount</label>
          <div className="amount-display-row">
            <span className="amount-currency-prefix">₹</span>
            <input
              id="expense-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="amount-input-hero"
              placeholder="0.00"
              value={amount}
              size={Math.max(4, (amount || '0.00').length + 1)}
              onChange={handleAmountChange}
              disabled={isSaving || isDeleting}
            />
          </div>

          {amountError && (
            <p className="amount-validation-msg" role="alert">
              {amountError}
            </p>
          )}
        </div>

        {/* Category Selector Grid */}
        <div className="form-group">
          <label className="form-label">Category</label>
          {categoryOptions.length === 0 ? (
            <div className="empty-chips-notice" role="alert">
              <p>No categories available.</p>
            </div>
          ) : (
            <div className="category-chips-grid">
              {categoryOptions.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-chip ${selectedCategory === cat.name ? 'selected' : ''} ${cat.isInactive ? 'chip-inactive' : ''}`}
                  onClick={() => setSelectedCategory(cat.name)}
                  title={cat.name}
                  disabled={isSaving || isDeleting}
                >
                  {cat.name}
                  {cat.isInactive && <span className="chip-inactive-indicator"> (Inactive)</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date Selector */}
        <div className={`form-group ${dateError ? 'has-error' : ''}`}>
          <label htmlFor="expense-date" className="form-label">Date</label>
          <input
            id="expense-date"
            type="date"
            className={`form-input date-input ${dateError ? 'input-error' : ''}`}
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            disabled={isSaving || isDeleting}
          />
          {dateError && (
            <p className="form-validation-msg" role="alert">
              {dateError}
            </p>
          )}
        </div>

        {/* Payment Method Selector */}
        <div className="form-group">
          <label className="form-label">Payment Method</label>
          {paymentMethodOptions.length === 0 ? (
            <div className="empty-chips-notice" role="alert">
              <p>No payment methods available.</p>
            </div>
          ) : (
            <div className="payment-chips-grid">
              {paymentMethodOptions.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  className={`payment-chip ${selectedPayment === method.name ? 'selected' : ''} ${method.isInactive ? 'chip-inactive' : ''}`}
                  onClick={() => setSelectedPayment(method.name)}
                  title={method.name}
                  disabled={isSaving || isDeleting}
                >
                  {method.name}
                  {method.isInactive && <span className="chip-inactive-indicator"> (Inactive)</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Optional Note Field (Max 120 chars) */}
        <div className="form-group">
          <label htmlFor="expense-note" className="form-label">
            Optional Note <span className="char-count">({note.length}/120)</span>
          </label>
          <input
            id="expense-note"
            type="text"
            className="form-input"
            placeholder="Add details (e.g. Metro pass, Lunch)"
            maxLength={120}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isSaving || isDeleting}
          />
        </div>

        {/* Save / Delete Error Notice with Retry */}
        {saveError && (
          <div className="save-error-box" role="alert">
            <p>{saveError}</p>
            <button
              type="button"
              className="btn-retry-save"
              onClick={() => handleSubmit()}
              disabled={isSaving || isDeleting}
            >
              Retry Save
            </button>
          </div>
        )}
        {deleteError && (
          <div className="save-error-box" role="alert">
            <p>{deleteError}</p>
            <button
              type="button"
              className="btn-retry-save"
              onClick={() => handleConfirmDelete()}
              disabled={isSaving || isDeleting}
            >
              Retry Delete
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="form-actions-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCancel}
            disabled={isSaving || isDeleting}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="btn-primary"
            disabled={!isFormValid || isSaving || isDeleting}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Full-width Delete Action Button */}
        <button
          type="button"
          className="btn-danger-outline"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isSaving || isDeleting}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>Delete Expense</span>
        </button>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="modal-backdrop"
          onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 id="delete-modal-title" className="modal-title">Delete Expense?</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isDeleting && setShowDeleteConfirm(false)}
                aria-label="Close dialog"
                disabled={isDeleting}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="modal-desc">
              Are you sure you want to delete this expense of{' '}
              <strong style={{ color: '#f8fafc' }}>
                ₹{formatPaiseToRupees(expense.amountInPaise)}
              </strong>{' '}
              ({expense.category}) on {expense.date}? This action cannot be undone.
            </p>

            {deleteError && (
              <p className="modal-error-text" role="alert">
                {deleteError}
              </p>
            )}

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-delete"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
