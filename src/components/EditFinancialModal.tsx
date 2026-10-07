import React, { useState, useEffect, useRef } from 'react';
import {
  rupeesToPaise,
  paiseToRupeesInput,
  MAX_AMOUNT_RUPEES,
  MAX_AMOUNT_PAISE,
} from '../utils/finance';

interface EditFinancialModalProps {
  isOpen: boolean;
  type: 'income' | 'budget';
  currentValueInPaise: number | null;
  onSave: (valueInPaise: number | null) => Promise<void> | void;
  onClose: () => void;
}

export const EditFinancialModal: React.FC<EditFinancialModalProps> = ({
  isOpen,
  type,
  currentValueInPaise,
  onSave,
  onClose,
}) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue(paiseToRupeesInput(currentValueInPaise));
      setError(null);
      setSaveError(null);
      setIsSaving(false);
      // Auto-focus after dialog render
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, currentValueInPaise]);

  if (!isOpen) return null;

  const isIncome = type === 'income';
  const title = isIncome
    ? (currentValueInPaise === null ? 'Set Monthly Income' : 'Edit Monthly Income')
    : (currentValueInPaise === null ? 'Set Monthly Budget' : 'Edit Monthly Budget');
  const description = isIncome
    ? 'Define your recurring monthly take-home income for budget calculations.'
    : 'Define your target spending limit for the month to track remaining allowance.';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    if (raw === '') {
      setInputValue('');
      setError(null);
      return;
    }

    // Allow only numeric digits and up to 2 decimal places
    if (!/^\d*(\.\d{0,2})?$/.test(raw)) {
      e.target.value = inputValue;
      return;
    }

    // Prevent multiple leading zeros ('00', '000', etc.)
    if (raw === '00' || /^00+/.test(raw)) {
      e.target.value = inputValue;
      return;
    }

    // If '0' followed by digit 1-9, replace leading 0
    if (raw.length > 1 && raw.startsWith('0') && raw[1] !== '.') {
      raw = raw.replace(/^0+/, '');
      if (raw === '') raw = '0';
    }

    // Hard ceiling on integer digits: MAX_AMOUNT (10,00,000) has 7 digits
    const integerPart = raw.split('.')[0] || '';
    if (integerPart.length > 7) {
      setError('Maximum amount is ₹10,00,000');
      e.target.value = inputValue;
      return;
    }

    const numVal = parseFloat(raw);
    if (!isNaN(numVal) && numVal > MAX_AMOUNT_RUPEES) {
      setError('Maximum amount is ₹10,00,000');
      e.target.value = inputValue;
      return;
    }

    // Disallow only 0
    if (!isNaN(numVal) && numVal === 0 && !raw.endsWith('.')) {
      setError('Amount must be greater than ₹0');
    } else {
      setError(null);
    }

    setInputValue(raw);
  };

  const handleSave = async () => {
    if (isSaving) return;

    if (inputValue.trim() === '') {
      try {
        setIsSaving(true);
        setSaveError(null);
        await onSave(null); // Clear/reset to unconfigured
        onClose();
      } catch (err) {
        console.error('Failed to clear financial setting:', err);
        setSaveError('Unable to update settings. Please try again.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (inputValue.trim() === '.') {
      setError('Amount must be greater than ₹0');
      return;
    }

    const paise = rupeesToPaise(inputValue);
    if (paise <= 0) {
      setError('Amount must be greater than ₹0');
      return;
    }

    if (paise > MAX_AMOUNT_PAISE) {
      setError('Maximum amount is ₹10,00,000');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      await onSave(paise);
      onClose();
    } catch (err) {
      console.error('Failed to save financial setting:', err);
      setSaveError('Unable to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
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
            <span className="modal-demo-badge">Monthly</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={isSaving}
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
            inputMode="decimal"
            className="modal-input"
            placeholder="0"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
          />
        </div>

        {error && <p className="modal-error-text" role="alert">{error}</p>}
        {saveError && <p className="modal-error-text" role="alert">{saveError}</p>}

        <p className="modal-hint-text">
          Saved locally on this device. Values persist across sessions.
        </p>

        <div className="modal-actions-row">
          <button
            type="button"
            className="btn-modal-cancel"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-modal-save"
            onClick={handleSave}
            disabled={isSaving || !!error}
          >
            {isSaving ? 'Saving...' : 'Save Value'}
          </button>
        </div>
      </div>
    </div>
  );
};
