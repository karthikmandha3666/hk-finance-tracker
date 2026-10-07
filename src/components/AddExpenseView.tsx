import React, { useState } from 'react';
import { ExpenseCategory } from '../types';

interface AddExpenseViewProps {
  onCancel: () => void;
}

const CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Travel',
  'Rent',
  'Bills',
  'Shopping',
  'Medical',
  'Family',
  'Coffee & Snacks',
  'Entertainment',
  'EMI/Loan',
  'Subscription',
  'Other',
];

const PAYMENT_METHODS = [
  'Cash',
  'UPI',
  'Debit Card',
  'Credit Card',
  'Bank Transfer',
  'Other',
];

// Maximum amount: ₹10,00,000 (10 Lakh)
const MAX_AMOUNT = 1000000;

// Helper to get local client date in YYYY-MM-DD format
const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AddExpenseView: React.FC<AddExpenseViewProps> = ({ onCancel }) => {
  // Amount MUST start completely empty for a new expense (no hardcoded ₹250 or demo value)
  const [amount, setAmount] = useState<string>('');
  const [amountError, setAmountError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory>('Food');
  const [selectedPayment, setSelectedPayment] = useState<string>('UPI');
  // Initialized dynamically from actual current client date
  const [date, setDate] = useState<string>(getTodayDateString);
  const [note, setNote] = useState<string>('');

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
    // Prevents entering unlimited characters
    const integerPart = raw.split('.')[0] || '';
    if (integerPart.length > 7) {
      setAmountError('Maximum amount is ₹10,00,000');
      e.target.value = amount;
      return;
    }

    // 6. Maximum amount enforcement: ₹10,00,000 (10 lakh)
    const numVal = parseFloat(raw);
    if (!isNaN(numVal) && numVal > MAX_AMOUNT) {
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

      <form className="add-expense-form" onSubmit={(e) => e.preventDefault()}>
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
          <div className="category-chips-grid">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`category-chip ${selectedCategory === cat ? 'selected' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
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
          <div className="payment-chips-grid">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                className={`payment-chip ${selectedPayment === method ? 'selected' : ''}`}
                onClick={() => setSelectedPayment(method)}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {/* Optional Note Field */}
        <div className="form-group">
          <label htmlFor="expense-note" className="form-label">Optional Note</label>
          <input
            id="expense-note"
            type="text"
            className="form-input"
            placeholder="Add details (e.g. Metro pass, Lunch)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Informational Stage Banner */}
        <div className="stage-info-box" role="status">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>
            <strong>Stage 2 UI Shell:</strong> Data persistence and storage will be implemented in Stage 3.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="form-actions-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn-primary-disabled"
            disabled
            title="Saving will be activated in Stage 3"
          >
            Save (Stage 3)
          </button>
        </div>
      </form>
    </div>
  );
};
