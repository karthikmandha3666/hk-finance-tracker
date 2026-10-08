import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Expense } from '../types';
import { expenseRepository } from '../repositories/expenseRepository';
import { categoryRepository } from '../repositories/categoryRepository';
import { paymentMethodRepository } from '../repositories/paymentMethodRepository';
import {
  rupeesToPaise,
  MAX_AMOUNT_RUPEES,
  MAX_AMOUNT_PAISE,
  getLocalTodayDateString,
} from '../utils/finance';

interface AddExpenseViewProps {
  onCancel: () => void;
  onExpenseAdded?: () => void;
  onNavigateToSettings?: () => void;
}

export const AddExpenseView: React.FC<AddExpenseViewProps> = ({
  onCancel,
  onExpenseAdded,
  onNavigateToSettings,
}) => {
  // Amount MUST start completely empty for a new expense (no hardcoded ₹250 or demo value)
  const [amount, setAmount] = useState<string>('');
  const [amountError, setAmountError] = useState<string | null>(null);

  // Live queries for active categories and payment methods from local repositories
  const activeCategories = useLiveQuery(() => categoryRepository.getActiveCategories()) ?? [];
  const activePaymentMethods = useLiveQuery(() => paymentMethodRepository.getActivePaymentMethods()) ?? [];

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  // Initialized dynamically from actual current local client date
  const [date, setDate] = useState<string>(getLocalTodayDateString);
  const [note, setNote] = useState<string>('');

  const effectiveCategory = selectedCategory || (activeCategories.length > 0 ? activeCategories[0].name : '');
  const effectivePayment = selectedPayment || (activePaymentMethods.length > 0 ? activePaymentMethods[0].name : '');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // 1. Allow completely empty string (backspacing all the way to empty)
    if (raw === '') {
      setAmount('');
      setAmountError(null);
      return;
    }

    // 2. Allow only valid numbers with at most one decimal point and up to 2 decimal places
    // Rejects letters, commas, negative signs, multiple dots, extra decimals
    if (!/^\d*(\.\d{0,2})?$/.test(raw)) {
      e.target.value = amount;
      return;
    }

    // 3. Prevent multiple leading zeros (e.g. '00', '000', '000000')
    // Never allow typing multiple zeros or unlimited zeros
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
    effectiveCategory !== '' &&
    effectivePayment !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const trimmedNote = note.trim().slice(0, 120);
      const nowIso = new Date().toISOString();

      const newExpense: Expense = {
        id: crypto.randomUUID(),
        amountInPaise: amountPaise,
        category: effectiveCategory,
        paymentMethod: effectivePayment,
        date: date.trim(),
        note: trimmedNote,
        currency: 'INR',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await expenseRepository.addExpense(newExpense);

      // Reset form
      setAmount('');
      setNote('');
      setDate(getLocalTodayDateString());
      setSelectedCategory('');
      setSelectedPayment('');

      // Notify parent & return to Home
      if (onExpenseAdded) {
        onExpenseAdded();
      }
      onCancel();
    } catch (err) {
      console.error('Failed to save expense to IndexedDB:', err);
      setSaveError('Unable to save expense to local storage. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <div className="add-expense-view">
      {/* View Header */}
      <div className="view-header">
        <button
          type="button"
          className="btn-icon-back"
          onClick={onCancel}
          aria-label="Back to Home"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 className="view-title">Add Expense</h2>
        <div className="header-placeholder" />
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
          {activeCategories.length === 0 ? (
            <div className="empty-chips-notice" role="alert">
              <p>No active categories available.</p>
              {onNavigateToSettings && (
                <button
                  type="button"
                  className="btn-link-settings"
                  onClick={onNavigateToSettings}
                >
                  Manage Categories in Settings &rarr;
                </button>
              )}
            </div>
          ) : (
            <div className="category-chips-grid">
              {activeCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-chip ${effectiveCategory === cat.name ? 'selected' : ''}`}
                  onClick={() => setSelectedCategory(cat.name)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date Selector */}
        <div className="form-group">
          <label htmlFor="expense-date" className="form-label">Date</label>
          <input
            id="expense-date"
            type="date"
            className="form-input date-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Payment Method Selector */}
        <div className="form-group">
          <label className="form-label">Payment Method</label>
          {activePaymentMethods.length === 0 ? (
            <div className="empty-chips-notice" role="alert">
              <p>No active payment methods available.</p>
              {onNavigateToSettings && (
                <button
                  type="button"
                  className="btn-link-settings"
                  onClick={onNavigateToSettings}
                >
                  Manage Payment Methods in Settings &rarr;
                </button>
              )}
            </div>
          ) : (
            <div className="payment-chips-grid">
              {activePaymentMethods.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  className={`payment-chip ${effectivePayment === method.name ? 'selected' : ''}`}
                  onClick={() => setSelectedPayment(method.name)}
                >
                  {method.name}
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
          />
        </div>

        {/* Save Error Notice */}
        {saveError && (
          <div className="save-error-box" role="alert">
            <p>{saveError}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="form-actions-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="btn-primary"
            disabled={!isFormValid || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </form>
    </div>
  );
};
