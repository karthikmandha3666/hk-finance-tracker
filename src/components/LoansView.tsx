import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Loan, LoanType } from '../types';
import { loanRepository } from '../repositories/loanRepository';
import { dashboardPreferencesRepository, DEFAULT_DASHBOARD_PREFERENCES } from '../repositories/dashboardPreferencesRepository';
import {
  formatPaiseToRupees,
  rupeesToPaise,
  paiseToRupeesInput,
  getLocalTodayDateString,
  calculateEMIInPaise,
  formatOrdinalDay,
} from '../utils/finance';

interface LoansViewProps {
  onBack: () => void;
  initialOpenAdd?: boolean;
}

const DEFAULT_LOAN_TYPES: LoanType[] = [
  'Personal Loan',
  'Home Loan',
  'Car Loan',
  'Credit Card EMI',
  'Consumer Loan',
  'Other',
];

export const LoansView: React.FC<LoansViewProps> = ({ onBack, initialOpenAdd = false }) => {
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(initialOpenAdd);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

  // Quick balance modal
  const [balanceModalLoan, setBalanceModalLoan] = useState<Loan | null>(null);
  const [quickBalanceInput, setQuickBalanceInput] = useState<string>('');

  // Form fields
  const [name, setName] = useState<string>('');
  const [loanType, setLoanType] = useState<string>('Personal Loan');
  const [principal, setPrincipal] = useState<string>('');
  const [outstanding, setOutstanding] = useState<string>('');
  const [interestRate, setInterestRate] = useState<string>('');
  const [emi, setEmi] = useState<string>('');
  const [dueDay, setDueDay] = useState<string>('5');
  const [tenure, setTenure] = useState<string>('12');
  const [startDate, setStartDate] = useState<string>(getLocalTodayDateString);
  const [note, setNote] = useState<string>('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [loanPendingDelete, setLoanPendingDelete] = useState<Loan | null>(null);

  // Live queries
  const allLoans = useLiveQuery(() => loanRepository.getLoans()) ?? [];

  // Dashboard section visibility preference
  const dashboardPrefs = useLiveQuery(
    () => dashboardPreferencesRepository.getPreferences(),
    [],
    DEFAULT_DASHBOARD_PREFERENCES
  );
  const showOnHome = dashboardPrefs?.showLoansSummary ?? true;

  const handleToggleShowOnHome = async () => {
    try {
      const nextVal = !showOnHome;
      await dashboardPreferencesRepository.updateLoansVisibility(nextVal);
      showFeedback(nextVal ? 'Loans & EMI Summary will show on Home' : 'Loans & EMI Summary hidden from Home');
    } catch (err) {
      console.error('Failed to update dashboard preferences:', err);
    }
  };

  const activeLoans = useMemo(() => {
    return allLoans
      .filter((l) => l.isActive)
      .sort((a, b) => a.dueDay - b.dueDay);
  }, [allLoans]);

  const inactiveLoans = useMemo(() => {
    return allLoans
      .filter((l) => !l.isActive)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [allLoans]);

  // Aggregate totals for active loans
  const totalOutstandingPaise = useMemo(() => {
    return activeLoans.reduce((sum, l) => sum + l.outstandingAmountInPaise, 0);
  }, [activeLoans]);

  const totalMonthlyEmiPaise = useMemo(() => {
    return activeLoans.reduce((sum, l) => sum + l.emiAmountInPaise, 0);
  }, [activeLoans]);

  // Dynamic informational EMI calculation based on form inputs
  const calculatedInformationalEmi = useMemo(() => {
    const pPaise = rupeesToPaise(principal);
    const rateNum = parseFloat(interestRate);
    const tenureNum = parseInt(tenure, 10);
    if (pPaise > 0 && !isNaN(rateNum) && rateNum >= 0 && !isNaN(tenureNum) && tenureNum > 0) {
      return calculateEMIInPaise(pPaise, rateNum, tenureNum);
    }
    return null;
  }, [principal, interestRate, tenure]);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleOpenAdd = () => {
    setEditingLoan(null);
    setName('');
    setLoanType('Personal Loan');
    setPrincipal('');
    setOutstanding('');
    setInterestRate('10.5');
    setEmi('');
    setDueDay('5');
    setTenure('12');
    setStartDate(getLocalTodayDateString());
    setNote('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (loan: Loan) => {
    setEditingLoan(loan);
    setName(loan.name);
    setLoanType(loan.loanType);
    setPrincipal(paiseToRupeesInput(loan.principalAmountInPaise));
    setOutstanding(paiseToRupeesInput(loan.outstandingAmountInPaise));
    setInterestRate(String(loan.interestRatePercent));
    setEmi(paiseToRupeesInput(loan.emiAmountInPaise));
    setDueDay(String(loan.dueDay));
    setTenure(String(loan.remainingTenureMonths));
    setStartDate(loan.startDate);
    setNote(loan.note || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingLoan(null);
    setFormError(null);
  };

  const handleOpenQuickBalance = (loan: Loan) => {
    setBalanceModalLoan(loan);
    setQuickBalanceInput(paiseToRupeesInput(loan.outstandingAmountInPaise));
    setFormError(null);
  };

  const handleSaveQuickBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceModalLoan || isSubmitting) return;

    const raw = quickBalanceInput.trim();
    if (raw === '') {
      setFormError('Please enter an outstanding amount.');
      return;
    }
    const paise = rupeesToPaise(raw);
    if (paise < 0) {
      setFormError('Outstanding amount cannot be negative.');
      return;
    }
    if (paise > balanceModalLoan.principalAmountInPaise) {
      setFormError('Outstanding balance cannot exceed original principal amount.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await loanRepository.updateOutstandingBalance(balanceModalLoan.id, paise);
      showFeedback(`Updated balance for "${balanceModalLoan.name}"`);
      setBalanceModalLoan(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update balance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Loan name is required.');
      return;
    }
    if (trimmedName.length > 50) {
      setFormError('Loan name cannot exceed 50 characters.');
      return;
    }

    const principalPaise = rupeesToPaise(principal);
    if (principalPaise <= 0) {
      setFormError('Principal amount must be greater than ₹0.');
      return;
    }

    const outstandingPaise = outstanding.trim() === '' ? principalPaise : rupeesToPaise(outstanding);
    if (outstandingPaise < 0) {
      setFormError('Outstanding amount cannot be negative.');
      return;
    }
    if (outstandingPaise > principalPaise) {
      setFormError('Outstanding balance cannot exceed original principal amount.');
      return;
    }

    const rateNum = parseFloat(interestRate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      setFormError('Interest rate must be between 0% and 100%.');
      return;
    }

    const emiPaise = rupeesToPaise(emi);
    if (emiPaise <= 0) {
      setFormError('Monthly EMI must be greater than ₹0.');
      return;
    }

    const dueDayNum = parseInt(dueDay, 10);
    if (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
      setFormError('Due day must be between 1 and 31.');
      return;
    }

    const tenureNum = parseInt(tenure, 10);
    if (isNaN(tenureNum) || tenureNum < 0) {
      setFormError('Remaining tenure must be 0 or more months.');
      return;
    }

    if (!startDate) {
      setFormError('Please select a valid start date.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingLoan) {
        await loanRepository.updateLoan({
          ...editingLoan,
          name: trimmedName,
          loanType: loanType.trim(),
          principalAmountInPaise: principalPaise,
          outstandingAmountInPaise: outstandingPaise,
          interestRatePercent: rateNum,
          emiAmountInPaise: emiPaise,
          dueDay: dueDayNum,
          remainingTenureMonths: tenureNum,
          startDate,
          note: note.trim() || undefined,
        });
        showFeedback(`Updated "${trimmedName}"`);
      } else {
        await loanRepository.addLoan({
          name: trimmedName,
          loanType: loanType.trim(),
          principalAmountInPaise: principalPaise,
          outstandingAmountInPaise: outstandingPaise,
          interestRatePercent: rateNum,
          emiAmountInPaise: emiPaise,
          dueDay: dueDayNum,
          remainingTenureMonths: tenureNum,
          startDate,
          note: note.trim() || undefined,
        });
        showFeedback(`Added loan "${trimmedName}"`);
      }
      setIsModalOpen(false);
      setEditingLoan(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save loan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (loan: Loan) => {
    try {
      await loanRepository.deactivateLoan(loan.id);
      showFeedback(`Closed loan "${loan.name}"`);
    } catch (err) {
      console.error('Failed to deactivate loan:', err);
      showFeedback('Failed to close loan. Please try again.');
    }
  };

  const handleReactivate = async (loan: Loan) => {
    try {
      await loanRepository.reactivateLoan(loan.id);
      showFeedback(`Reactivated loan "${loan.name}"`);
    } catch (err) {
      console.error('Failed to reactivate loan:', err);
      showFeedback('Failed to reactivate loan. Please try again.');
    }
  };

  const handleDeleteLoan = async (loan: Loan) => {
    setIsSubmitting(true);
    try {
      await loanRepository.deleteLoan(loan.id);
      showFeedback(`Deleted loan "${loan.name}"`);
      setLoanPendingDelete(null);
    } catch (err) {
      console.error('Failed to delete loan:', err);
      showFeedback('Failed to delete loan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderLoanCard = (loan: Loan, isInactive = false) => {
    const paidOffPercent =
      loan.principalAmountInPaise > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                ((loan.principalAmountInPaise - loan.outstandingAmountInPaise) /
                  loan.principalAmountInPaise) *
                  100
              )
            )
          )
        : 0;

    return (
      <div key={loan.id} className={`loan-card ${isInactive ? 'inactive' : ''}`}>
        <div className="loan-card-top">
          <div className="loan-title-group">
            <h4 className="loan-name" title={loan.name}>{loan.name}</h4>
            <div className="loan-tags">
              <span className="loan-type-tag" title={loan.loanType}>{loan.loanType}</span>
              <span className="loan-rate-tag">{loan.interestRatePercent}% p.a.</span>
              <span className="loan-due-tag">Due: {formatOrdinalDay(loan.dueDay)}</span>
            </div>
          </div>

          <div className="loan-status-group">
            <span className={`loan-status-badge ${isInactive ? 'closed' : 'active'}`}>
              {isInactive ? 'Closed' : 'Active'}
            </span>
          </div>
        </div>

        {/* Financial metrics grid */}
        <div className="loan-metrics-grid">
          <div className="loan-metric-box primary">
            <span className="metric-label">Outstanding</span>
            <span className="metric-val text-rose">
              ₹{formatPaiseToRupees(loan.outstandingAmountInPaise)}
            </span>
          </div>

          <div className="loan-metric-box">
            <span className="metric-label">Monthly EMI</span>
            <span className="metric-val text-cyan">
              ₹{formatPaiseToRupees(loan.emiAmountInPaise)}
            </span>
          </div>

          <div className="loan-metric-box">
            <span className="metric-label">Principal</span>
            <span className="metric-val">
              ₹{formatPaiseToRupees(loan.principalAmountInPaise)}
            </span>
          </div>

          <div className="loan-metric-box">
            <span className="metric-label">Tenure Left</span>
            <span className="metric-val">{loan.remainingTenureMonths} mos</span>
          </div>
        </div>

        {/* Repayment progress */}
        <div className="loan-progress-container">
          <div className="loan-progress-labels">
            <span>Repaid: {paidOffPercent}%</span>
            <span>Principal: ₹{formatPaiseToRupees(loan.principalAmountInPaise)}</span>
          </div>
          <div className="loan-progress-bar">
            <div
              className="loan-progress-fill"
              style={{ width: `${paidOffPercent}%` }}
            />
          </div>
        </div>

        {loan.note && <p className="loan-note" title={loan.note}>{loan.note}</p>}

        {/* Actions bar */}
        <div className="loan-card-actions">
          {!isInactive && (
            <button
              type="button"
              className="btn-quick-balance"
              onClick={() => handleOpenQuickBalance(loan)}
              title="Update outstanding balance"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>Update Balance</span>
            </button>
          )}

          <div className="loan-secondary-actions">
            <button
              type="button"
              className="btn-card-icon edit"
              onClick={() => handleOpenEdit(loan)}
              title="Edit Loan"
              aria-label={`Edit ${loan.name}`}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </button>

            {isInactive ? (
              <button
                type="button"
                className="btn-card-action reactivate"
                onClick={() => handleReactivate(loan)}
                aria-label={`Reactivate ${loan.name}`}
              >
                Reopen
              </button>
            ) : (
              <button
                type="button"
                className="btn-card-action deactivate"
                onClick={() => handleDeactivate(loan)}
                aria-label={`Close loan ${loan.name}`}
              >
                Close Loan
              </button>
            )}

            <button
              type="button"
              className="btn-card-icon delete"
              onClick={() => setLoanPendingDelete(loan)}
              title="Delete Loan"
              aria-label={`Delete ${loan.name}`}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="loans-view">
      {/* Header */}
      <div className="view-header">
        <button
          type="button"
          className="btn-icon-back"
          onClick={onBack}
          aria-label="Back to Home"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 className="view-title">Loans & EMI</h2>
        <div className="header-placeholder" />
      </div>

      {feedbackMsg && (
        <div className="toast-notification" role="status">
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Home Visibility Preference Setting */}
      <div className="home-pref-setting-card">
        <div className="home-pref-info">
          <span className="home-pref-title">Show on Home</span>
          <span className="home-pref-desc">Display loans & EMI summary on the Home dashboard</span>
        </div>
        <button
          type="button"
          role="switch"
          id="loans-show-on-home-toggle"
          aria-checked={showOnHome}
          aria-label="Show on Home"
          className={`home-pref-toggle-btn ${showOnHome ? 'is-on' : 'is-off'}`}
          onClick={handleToggleShowOnHome}
        >
          <span className="home-pref-toggle-state-label">{showOnHome ? 'ON' : 'OFF'}</span>
          <span className="home-pref-toggle-thumb" aria-hidden="true" />
        </button>
      </div>

      {/* Hero Summary Cards for Active Loans */}
      <div className="loans-summary-hero">
        <div className="loan-summary-box">
          <span className="hero-sublabel">Total Outstanding</span>
          <span className="hero-amount text-rose">
            ₹{formatPaiseToRupees(totalOutstandingPaise)}
          </span>
          <span className="hero-hint">{activeLoans.length} active liability</span>
        </div>
        <div className="loan-summary-box">
          <span className="hero-sublabel">Monthly EMI Commitment</span>
          <span className="hero-amount text-cyan">
            ₹{formatPaiseToRupees(totalMonthlyEmiPaise)}
          </span>
          <span className="hero-hint">Due across the month</span>
        </div>
      </div>

      {/* Action Header & Tabs */}
      <div className="loans-action-bar">
        <div className="loans-subtabs">
          <button
            type="button"
            className={`loans-subtab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active ({activeLoans.length})
          </button>
          <button
            type="button"
            className={`loans-subtab-btn ${activeTab === 'inactive' ? 'active' : ''}`}
            onClick={() => setActiveTab('inactive')}
          >
            Closed ({inactiveLoans.length})
          </button>
        </div>

        <button
          type="button"
          className="btn-add-loan"
          onClick={handleOpenAdd}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Loan</span>
        </button>
      </div>

      {/* Active Tab */}
      {activeTab === 'active' && (
        <div className="loans-content-list">
          {activeLoans.length === 0 ? (
            <div className="loans-empty-card">
              <div className="loans-empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <h3 className="loans-empty-title">No Active Loans</h3>
              <p className="loans-empty-desc">
                Track personal loans, car loans, home loans, and credit card EMIs in one place.
              </p>
              <button
                type="button"
                className="btn-empty-add-loan"
                onClick={handleOpenAdd}
              >
                + Add Loan or EMI
              </button>
            </div>
          ) : (
            <div className="loans-stack">
              {activeLoans.map((l) => renderLoanCard(l, false))}
            </div>
          )}
        </div>
      )}

      {/* Inactive / Closed Tab */}
      {activeTab === 'inactive' && (
        <div className="loans-content-list">
          {inactiveLoans.length === 0 ? (
            <div className="loans-empty-card">
              <p className="loans-empty-desc">No closed or inactive loans.</p>
            </div>
          ) : (
            <div className="loans-stack">
              {inactiveLoans.map((l) => renderLoanCard(l, true))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Loan Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={handleCloseModal} role="presentation">
          <div
            className="modal-card loan-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="loan-modal-title"
          >
            <div className="modal-header">
              <h3 id="loan-modal-title" className="modal-title">
                {editingLoan ? 'Edit Loan & EMI' : 'Add Loan / EMI'}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseModal}
                aria-label="Close dialog"
                disabled={isSubmitting}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="loan-form">
              {/* Loan Name */}
              <div className="form-group">
                <label htmlFor="loan-name-input" className="form-label">
                  Loan Name <span className="char-count">({name.length}/50)</span>
                </label>
                <input
                  id="loan-name-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. HDFC Home Loan, Axis Car Loan"
                  maxLength={50}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>

              {/* Loan Type Chips */}
              <div className="form-group">
                <label className="form-label">Loan Type</label>
                <div className="loan-type-chips-grid">
                  {DEFAULT_LOAN_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`loan-type-chip ${loanType === t ? 'selected' : ''}`}
                      onClick={() => setLoanType(t)}
                      disabled={isSubmitting}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Principal & Outstanding */}
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="loan-principal-input" className="form-label">Principal Amount</label>
                  <div className="amount-input-row">
                    <span className="amount-currency-prefix">₹</span>
                    <input
                      id="loan-principal-input"
                      type="text"
                      inputMode="decimal"
                      className="form-input amount-styled-input"
                      placeholder="0.00"
                      value={principal}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '' || /^\d*(\.\d{0,2})?$/.test(raw)) setPrincipal(raw);
                      }}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="loan-outstanding-input" className="form-label">Outstanding Balance</label>
                  <div className="amount-input-row">
                    <span className="amount-currency-prefix">₹</span>
                    <input
                      id="loan-outstanding-input"
                      type="text"
                      inputMode="decimal"
                      className="form-input amount-styled-input"
                      placeholder={principal || '0.00'}
                      value={outstanding}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '' || /^\d*(\.\d{0,2})?$/.test(raw)) setOutstanding(raw);
                      }}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              {/* Interest Rate & Tenure */}
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="loan-interest-input" className="form-label">Interest Rate (% p.a.)</label>
                  <input
                    id="loan-interest-input"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="form-input"
                    placeholder="e.g. 9.5"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="loan-tenure-input" className="form-label">Remaining Tenure (Months)</label>
                  <input
                    id="loan-tenure-input"
                    type="number"
                    min="0"
                    max="600"
                    className="form-input"
                    placeholder="e.g. 36"
                    value={tenure}
                    onChange={(e) => setTenure(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Informational EMI suggestion box */}
              {calculatedInformationalEmi !== null && (
                <div className="emi-calculator-banner">
                  <div className="banner-left">
                    <span className="banner-title">Standard Calculated EMI:</span>
                    <span className="banner-emi-val">
                      ₹{formatPaiseToRupees(calculatedInformationalEmi)} / mo
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-use-calculated"
                    onClick={() => setEmi(paiseToRupeesInput(calculatedInformationalEmi))}
                  >
                    Apply
                  </button>
                </div>
              )}

              {/* Monthly EMI & Due Day */}
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="loan-emi-input" className="form-label">Actual Monthly EMI</label>
                  <div className="amount-input-row">
                    <span className="amount-currency-prefix">₹</span>
                    <input
                      id="loan-emi-input"
                      type="text"
                      inputMode="decimal"
                      className="form-input amount-styled-input"
                      placeholder="0.00"
                      value={emi}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '' || /^\d*(\.\d{0,2})?$/.test(raw)) setEmi(raw);
                      }}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="loan-dueday-input" className="form-label">Due Day of Month</label>
                  <input
                    id="loan-dueday-input"
                    type="number"
                    min="1"
                    max="31"
                    className="form-input"
                    placeholder="1 to 31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Start Date */}
              <div className="form-group">
                <label htmlFor="loan-startdate-input" className="form-label">Loan Start Date</label>
                <input
                  id="loan-startdate-input"
                  type="date"
                  className="form-input date-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Optional Note */}
              <div className="form-group">
                <label htmlFor="loan-note-input" className="form-label">
                  Optional Note <span className="char-count">({note.length}/120)</span>
                </label>
                <input
                  id="loan-note-input"
                  type="text"
                  className="form-input"
                  placeholder="Loan account number or branch info"
                  maxLength={120}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {formError && (
                <p className="modal-error-text mb-2" role="alert">
                  {formError}
                </p>
              )}

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-save"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : editingLoan ? 'Save Changes' : 'Add Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Balance Update Modal */}
      {balanceModalLoan && (
        <div
          className="modal-backdrop"
          onClick={() => !isSubmitting && setBalanceModalLoan(null)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-balance-title"
          >
            <div className="modal-header">
              <h3 id="quick-balance-title" className="modal-title">
                Update Outstanding Balance
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setBalanceModalLoan(null)}
                aria-label="Close dialog"
                disabled={isSubmitting}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="modal-desc">
              Updating balance for <strong style={{ color: '#f8fafc' }}>{balanceModalLoan.name}</strong>.
            </p>

            <form onSubmit={handleSaveQuickBalance}>
              <div className="form-group mb-3">
                <label htmlFor="quick-balance-input" className="form-label">
                  New Outstanding Balance
                </label>
                <div className="amount-input-row">
                  <span className="amount-currency-prefix">₹</span>
                  <input
                    id="quick-balance-input"
                    type="text"
                    inputMode="decimal"
                    className="form-input amount-styled-input"
                    value={quickBalanceInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '' || /^\d*(\.\d{0,2})?$/.test(raw)) setQuickBalanceInput(raw);
                    }}
                    autoFocus
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {formError && (
                <p className="modal-error-text mb-2" role="alert">
                  {formError}
                </p>
              )}

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setBalanceModalLoan(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-save"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {loanPendingDelete && (
        <div
          className="modal-backdrop"
          onClick={() => setLoanPendingDelete(null)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-loan-modal-title"
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 id="delete-loan-modal-title" className="modal-title">Delete Loan?</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setLoanPendingDelete(null)}
                aria-label="Close dialog"
                disabled={isSubmitting}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="modal-desc">
              Are you sure you want to permanently delete{' '}
              <strong style={{ color: '#f8fafc' }}>
                "{loanPendingDelete.name}"
              </strong>? This action cannot be undone. Pre-existing expenses will remain untouched.
            </p>

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setLoanPendingDelete(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-delete"
                onClick={() => handleDeleteLoan(loanPendingDelete)}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
