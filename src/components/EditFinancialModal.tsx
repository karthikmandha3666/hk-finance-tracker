import React, { useState, useEffect, useRef } from 'react';

interface EditFinancialModalProps {
  isOpen: boolean;
  type: 'income' | 'budget';
  currentValue: number | null;
  onSave: (value: number | null) => void;
  onClose: () => void;
}

export const EditFinancialModal: React.FC<EditFinancialModalProps> = ({
  isOpen,
  type,
  currentValue,
  onSave,
  onClose,
}) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue(currentValue !== null ? currentValue.toString() : '');
      setError(null);
      // Auto-focus after dialog render
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, currentValue]);

  if (!isOpen) return null;

  const isIncome = type === 'income';
  const title = isIncome ? (currentValue === null ? 'Set Monthly Income' : 'Edit Monthly Income') : (currentValue === null ? 'Set Monthly Budget' : 'Edit Monthly Budget');
  const description = isIncome
    ? 'Define your recurring monthly take-home income for budget calculations.'
    : 'Define your target spending limit for the month to track remaining allowance.';

  const MAX_LIMIT = 1000000;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    if (raw === '') {
      setInputValue('');
      setError(null);
      return;
    }

    // Allow only numeric digits
    if (!/^\d*$/.test(raw)) {
      e.target.value = inputValue;
      return;
    }

    // Prevent multiple leading zeros ('00', '000', etc.)
    if (raw === '00' || /^00+/.test(raw)) {
      e.target.value = inputValue;
      return;
    }

    // If '0' followed by digit 1-9, replace leading 0
    if (raw.length > 1 && raw.startsWith('0')) {
      raw = raw.replace(/^0+/, '');
      if (raw === '') raw = '0';
    }

    // Max 7 digits (₹10,00,000)
    if (raw.length > 7) {
      setError('Maximum amount is ₹10,00,000');
      e.target.value = inputValue;
      return;
    }

    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > MAX_LIMIT) {
      setError('Maximum amount is ₹10,00,000');
      e.target.value = inputValue;
      return;
    }

    // Disallow only 0
    if (!isNaN(num) && num === 0) {
      setError('Amount must be greater than ₹0');
    } else {
      setError(null);
    }

    setInputValue(raw);
  };

  const handleSave = () => {
    if (inputValue.trim() === '') {
      onSave(null); // Clear/reset to unconfigured
      onClose();
      return;
    }

    const num = parseInt(inputValue, 10);
    if (isNaN(num) || num <= 0) {
      setError('Amount must be greater than ₹0');
      return;
    }

    onSave(num);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 id="modal-title" className="modal-title">{title}</h3>
            <span className="modal-demo-badge">In-Memory State</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="modal-desc">{description}</p>

        <div className="modal-input-wrapper">
          <span className="modal-currency-tag">₹</span>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            className="modal-input"
            placeholder="0"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
        </div>

        {error && <p className="modal-error-text" role="alert">{error}</p>}

        <p className="modal-hint-text">
          Temporary Stage 2 session state: Refreshing resets this value.
        </p>

        <div className="modal-actions-row">
          <button
            type="button"
            className="btn-modal-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-modal-save"
            onClick={handleSave}
          >
            Save Value
          </button>
        </div>
      </div>
    </div>
  );
};
