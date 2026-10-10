import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RecurringPayment, RecurrenceFrequency } from '../types';
import { recurringPaymentRepository } from '../repositories/recurringPaymentRepository';
import { categoryRepository } from '../repositories/categoryRepository';
import { paymentMethodRepository } from '../repositories/paymentMethodRepository';
import { dashboardPreferencesRepository, DEFAULT_DASHBOARD_PREFERENCES } from '../repositories/dashboardPreferencesRepository';
import {
  formatPaiseToRupees,
  rupeesToPaise,
  paiseToRupeesInput,
  getLocalTodayDateString,
  getDueDateStatus,
  formatDueDateFriendly,
  MAX_AMOUNT_RUPEES,
  MAX_AMOUNT_PAISE,
} from '../utils/finance';

interface UpcomingPaymentsViewProps {
  onBack: () => void;
  initialOpenAdd?: boolean;
}

const FREQUENCIES: RecurrenceFrequency[] = ['One-time', 'Daily', 'Weekly', 'Monthly', 'Yearly'];

export const UpcomingPaymentsView: React.FC<UpcomingPaymentsViewProps> = ({ onBack, initialOpenAdd = false }) => {
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');

  // Modal editor state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(initialOpenAdd);
  const [editingPayment, setEditingPayment] = useState<RecurringPayment | null>(null);

  // Form fields
  const [name, setName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('Monthly');
  const [nextDueDate, setNextDueDate] = useState<string>(getLocalTodayDateString);
  const [note, setNote] = useState<string>('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);
  const [paymentPendingDelete, setPaymentPendingDelete] = useState<RecurringPayment | null>(null);

  // Reactive data queries
  const allPayments = useLiveQuery(() => recurringPaymentRepository.getRecurringPayments()) ?? [];
  const activeCategories = useLiveQuery(() => categoryRepository.getActiveCategories()) ?? [];
  const activePaymentMethods = useLiveQuery(() => paymentMethodRepository.getActivePaymentMethods()) ?? [];

  // Dashboard section visibility preference
  const dashboardPrefs = useLiveQuery(
    () => dashboardPreferencesRepository.getPreferences(),
    [],
    DEFAULT_DASHBOARD_PREFERENCES
  );
  const showOnHome = dashboardPrefs?.showUpcomingObligations ?? true;

  const handleToggleShowOnHome = async () => {
    try {
      const nextVal = !showOnHome;
      await dashboardPreferencesRepository.updateUpcomingVisibility(nextVal);
      showFeedback(nextVal ? 'Upcoming Obligations will show on Home' : 'Upcoming Obligations hidden from Home');
    } catch (err) {
      console.error('Failed to update dashboard preferences:', err);
    }
  };

  const localToday = getLocalTodayDateString();

  const activePayments = useMemo(() => {
    return allPayments
      .filter((p) => p.isActive)
      .sort((a, b) => {
        if (a.nextDueDate !== b.nextDueDate) return a.nextDueDate.localeCompare(b.nextDueDate);
        return a.createdAt.localeCompare(b.createdAt);
      });
  }, [allPayments]);

  const inactivePayments = useMemo(() => {
    return allPayments.filter((p) => !p.isActive);
  }, [allPayments]);

  // Group active payments by due date status
  const groupedActive = useMemo(() => {
    const overdue: RecurringPayment[] = [];
    const today: RecurringPayment[] = [];
    const within7Days: RecurringPayment[] = [];
    const later: RecurringPayment[] = [];

    for (const payment of activePayments) {
      const status = getDueDateStatus(payment.nextDueDate, localToday);
      if (status === 'overdue') overdue.push(payment);
      else if (status === 'today') today.push(payment);
      else if (status === 'within-7-days') within7Days.push(payment);
      else later.push(payment);
    }

    return { overdue, today, within7Days, later };
  }, [activePayments, localToday]);

  // Options for Category (including historical inactive if editing)
  const categoryOptions = useMemo(() => {
    const options = activeCategories.map((c) => ({
      id: c.id,
      name: c.name,
      isInactive: false,
    }));
    if (editingPayment && editingPayment.category) {
      const exists = options.some((opt) => opt.name === editingPayment.category);
      if (!exists) {
        options.push({
          id: '__hist_cat__',
          name: editingPayment.category,
          isInactive: true,
        });
      }
    }
    return options;
  }, [activeCategories, editingPayment]);

  // Options for Payment Method (including historical inactive if editing)
  const paymentMethodOptions = useMemo(() => {
    const options = activePaymentMethods.map((m) => ({
      id: m.id,
      name: m.name,
      isInactive: false,
    }));
    if (editingPayment && editingPayment.paymentMethod) {
      const exists = options.some((opt) => opt.name === editingPayment.paymentMethod);
      if (!exists) {
        options.push({
          id: '__hist_pm__',
          name: editingPayment.paymentMethod,
          isInactive: true,
        });
      }
    }
    return options;
  }, [activePaymentMethods, editingPayment]);

  const handleOpenAdd = () => {
    setEditingPayment(null);
    setName('');
    setAmount('');
    setSelectedCategory(activeCategories.length > 0 ? activeCategories[0].name : '');
    setSelectedPaymentMethod(activePaymentMethods.length > 0 ? activePaymentMethods[0].name : '');
    setFrequency('Monthly');
    setNextDueDate(getLocalTodayDateString());
    setNote('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (payment: RecurringPayment) => {
    setEditingPayment(payment);
    setName(payment.name);
    setAmount(paiseToRupeesInput(payment.amountInPaise));
    setSelectedCategory(payment.category);
    setSelectedPaymentMethod(payment.paymentMethod);
    setFrequency(payment.frequency);
    setNextDueDate(payment.nextDueDate);
    setNote(payment.note || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingPayment(null);
    setFormError(null);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      setAmount('');
      return;
    }
    if (!/^\d*(\.\d{0,2})?$/.test(raw)) return;
    if (raw === '00' || /^00+/.test(raw)) return;

    const numVal = parseFloat(raw);
    if (!isNaN(numVal) && numVal > MAX_AMOUNT_RUPEES) return;

    setAmount(raw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Payment name is required.');
      return;
    }
    if (trimmedName.length > 50) {
      setFormError('Payment name cannot exceed 50 characters.');
      return;
    }

    const paise = rupeesToPaise(amount);
    if (paise <= 0) {
      setFormError('Amount must be greater than ₹0.');
      return;
    }
    if (paise > MAX_AMOUNT_PAISE) {
      setFormError('Amount cannot exceed ₹10,00,000.');
      return;
    }

    const catToSave = selectedCategory || (categoryOptions.length > 0 ? categoryOptions[0].name : '');
    if (!catToSave) {
      setFormError('Please select or add a category.');
      return;
    }

    const pmToSave = selectedPaymentMethod || (paymentMethodOptions.length > 0 ? paymentMethodOptions[0].name : '');
    if (!pmToSave) {
      setFormError('Please select or add a payment method.');
      return;
    }

    if (!nextDueDate) {
      setFormError('Please select a valid due date.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingPayment) {
        await recurringPaymentRepository.updateRecurringPayment({
          ...editingPayment,
          name: trimmedName,
          amountInPaise: paise,
          category: catToSave,
          paymentMethod: pmToSave,
          frequency,
          nextDueDate,
          note: note.trim() || undefined,
        });
        showFeedback(`Updated "${trimmedName}"`);
      } else {
        await recurringPaymentRepository.addRecurringPayment({
          name: trimmedName,
          amountInPaise: paise,
          category: catToSave,
          paymentMethod: pmToSave,
          frequency,
          nextDueDate,
          note: note.trim() || undefined,
        });
        showFeedback(`Added recurring payment "${trimmedName}"`);
      }
      setIsModalOpen(false);
      setEditingPayment(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAsPaid = async (payment: RecurringPayment) => {
    if (processingPaymentId) return;
    setProcessingPaymentId(payment.id);
    try {
      const updated = await recurringPaymentRepository.markAsPaid(payment.id, payment.nextDueDate);
      if (payment.frequency === 'One-time') {
        showFeedback(`Marked "${payment.name}" as paid (completed)`);
      } else {
        showFeedback(`Paid "${payment.name}". Next due: ${updated.nextDueDate}`);
      }
    } catch (err) {
      console.error('Failed to mark as paid:', err);
      showFeedback('Failed to mark payment as paid. Please try again.');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  const handleDeactivate = async (payment: RecurringPayment) => {
    try {
      await recurringPaymentRepository.deactivateRecurringPayment(payment.id);
      showFeedback(`Deactivated "${payment.name}"`);
    } catch (err) {
      console.error('Failed to deactivate payment:', err);
      showFeedback('Failed to deactivate payment. Please try again.');
    }
  };

  const handleReactivate = async (payment: RecurringPayment) => {
    try {
      await recurringPaymentRepository.reactivateRecurringPayment(payment.id);
      showFeedback(`Reactivated "${payment.name}"`);
    } catch (err) {
      console.error('Failed to reactivate payment:', err);
      showFeedback('Failed to reactivate payment. Please try again.');
    }
  };

  const handleDeletePayment = async (payment: RecurringPayment) => {
    setIsSubmitting(true);
    try {
      await recurringPaymentRepository.deleteRecurringPayment(payment.id);
      showFeedback(`Deleted "${payment.name}"`);
      setPaymentPendingDelete(null);
    } catch (err) {
      console.error('Failed to delete payment:', err);
      showFeedback('Failed to delete payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const renderPaymentCard = (payment: RecurringPayment, isInactive = false) => {
    const status = getDueDateStatus(payment.nextDueDate, localToday);
    return (
      <div key={payment.id} className={`upcoming-card ${isInactive ? 'inactive' : status}`}>
        <div className="upcoming-card-top">
          <div className="upcoming-title-group">
            <h4 className="upcoming-name" title={payment.name}>{payment.name}</h4>
            <div className="upcoming-tags">
              <span className="upcoming-category-tag" title={payment.category}>{payment.category}</span>
              <span className="upcoming-method-tag" title={payment.paymentMethod}>{payment.paymentMethod}</span>
              <span className="upcoming-freq-tag">{payment.frequency}</span>
            </div>
          </div>
          <div className="upcoming-amount-group">
            <span className="upcoming-amount">₹{formatPaiseToRupees(payment.amountInPaise)}</span>
            <span className={`upcoming-status-badge ${status}`}>
              {isInactive ? 'Inactive' : formatDueDateFriendly(payment.nextDueDate, localToday)}
            </span>
          </div>
        </div>

        {payment.note && <p className="upcoming-note" title={payment.note}>{payment.note}</p>}

        <div className="upcoming-card-actions">
          {!isInactive && (
            <button
              type="button"
              className="btn-mark-paid"
              onClick={() => handleMarkAsPaid(payment)}
              disabled={processingPaymentId === payment.id}
              aria-busy={processingPaymentId === payment.id}
              title="Mark as paid"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{processingPaymentId === payment.id ? 'Processing...' : 'Mark as Paid'}</span>
            </button>
          )}

          <div className="upcoming-secondary-actions">
            <button
              type="button"
              className="btn-card-icon edit"
              onClick={() => handleOpenEdit(payment)}
              title="Edit"
              aria-label={`Edit ${payment.name}`}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </button>

            {isInactive ? (
              <button
                type="button"
                className="btn-card-action reactivate"
                onClick={() => handleReactivate(payment)}
                aria-label={`Reactivate ${payment.name}`}
              >
                Reactivate
              </button>
            ) : (
              <button
                type="button"
                className="btn-card-action deactivate"
                onClick={() => handleDeactivate(payment)}
                aria-label={`Deactivate ${payment.name}`}
              >
                Deactivate
              </button>
            )}

            <button
              type="button"
              className="btn-card-icon delete"
              onClick={() => setPaymentPendingDelete(payment)}
              title="Delete"
              aria-label={`Delete ${payment.name}`}
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
    <div className="upcoming-payments-view">
      {/* View Header */}
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
        <h2 className="view-title">Upcoming Payments</h2>
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
          <span className="home-pref-desc">Display upcoming obligations on the Home dashboard</span>
        </div>
        <button
          type="button"
          role="switch"
          id="upcoming-show-on-home-toggle"
          aria-checked={showOnHome}
          aria-label="Show on Home"
          className={`home-pref-toggle-btn ${showOnHome ? 'is-on' : 'is-off'}`}
          onClick={handleToggleShowOnHome}
        >
          <span className="home-pref-toggle-state-label">{showOnHome ? 'ON' : 'OFF'}</span>
          <span className="home-pref-toggle-thumb" aria-hidden="true" />
        </button>
      </div>

      {/* Action Header */}
      <div className="upcoming-action-bar">
        {/* Subtabs */}
        <div className="upcoming-subtabs">
          <button
            type="button"
            className={`upcoming-subtab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active ({activePayments.length})
          </button>
          <button
            type="button"
            className={`upcoming-subtab-btn ${activeTab === 'inactive' ? 'active' : ''}`}
            onClick={() => setActiveTab('inactive')}
          >
            Inactive ({inactivePayments.length})
          </button>
        </div>

        <button
          type="button"
          className="btn-add-upcoming"
          onClick={handleOpenAdd}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Payment</span>
        </button>
      </div>

      {/* Active Tab Content */}
      {activeTab === 'active' && (
        <div className="upcoming-content-list">
          {activePayments.length === 0 ? (
            <div className="upcoming-empty-card">
              <div className="upcoming-empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h3 className="upcoming-empty-title">No Active Upcoming Payments</h3>
              <p className="upcoming-empty-desc">
                Record rent, subscriptions, bills, and recurring payments to stay ahead of upcoming expenses.
              </p>
              <button
                type="button"
                className="btn-empty-add-upcoming"
                onClick={handleOpenAdd}
              >
                + Add Upcoming Payment
              </button>
            </div>
          ) : (
            <>
              {/* Overdue Section */}
              {groupedActive.overdue.length > 0 && (
                <section className="upcoming-group-section overdue">
                  <h3 className="upcoming-group-title overdue">
                    <span className="group-dot overdue" />
                    Overdue ({groupedActive.overdue.length})
                  </h3>
                  <div className="upcoming-cards-stack">
                    {groupedActive.overdue.map((p) => renderPaymentCard(p))}
                  </div>
                </section>
              )}

              {/* Due Today Section */}
              {groupedActive.today.length > 0 && (
                <section className="upcoming-group-section today">
                  <h3 className="upcoming-group-title today">
                    <span className="group-dot today" />
                    Due Today ({groupedActive.today.length})
                  </h3>
                  <div className="upcoming-cards-stack">
                    {groupedActive.today.map((p) => renderPaymentCard(p))}
                  </div>
                </section>
              )}

              {/* Due within 7 days Section */}
              {groupedActive.within7Days.length > 0 && (
                <section className="upcoming-group-section within-7">
                  <h3 className="upcoming-group-title within-7">
                    <span className="group-dot within-7" />
                    Due Within 7 Days ({groupedActive.within7Days.length})
                  </h3>
                  <div className="upcoming-cards-stack">
                    {groupedActive.within7Days.map((p) => renderPaymentCard(p))}
                  </div>
                </section>
              )}

              {/* Due Later Section */}
              {groupedActive.later.length > 0 && (
                <section className="upcoming-group-section later">
                  <h3 className="upcoming-group-title later">
                    <span className="group-dot later" />
                    Due Later ({groupedActive.later.length})
                  </h3>
                  <div className="upcoming-cards-stack">
                    {groupedActive.later.map((p) => renderPaymentCard(p))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* Inactive Tab Content */}
      {activeTab === 'inactive' && (
        <div className="upcoming-content-list">
          {inactivePayments.length === 0 ? (
            <div className="upcoming-empty-card">
              <p className="upcoming-empty-desc">No inactive recurring payments.</p>
            </div>
          ) : (
            <div className="upcoming-cards-stack">
              {inactivePayments.map((p) => renderPaymentCard(p, true))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={handleCloseModal} role="presentation">
          <div
            className="modal-card upcoming-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upcoming-modal-title"
          >
            <div className="modal-header">
              <h3 id="upcoming-modal-title" className="modal-title">
                {editingPayment ? 'Edit Payment Obligation' : 'Add Upcoming Payment'}
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

            <form onSubmit={handleSubmit} className="upcoming-form">
              {/* Payment Name */}
              <div className="form-group">
                <label htmlFor="payment-name-input" className="form-label">
                  Payment Name <span className="char-count">({name.length}/50)</span>
                </label>
                <input
                  id="payment-name-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. House Rent, WiFi, Netflix"
                  maxLength={50}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>

              {/* Amount */}
              <div className="form-group">
                <label htmlFor="payment-amount-input" className="form-label">Amount</label>
                <div className="amount-input-row">
                  <span className="amount-currency-prefix">₹</span>
                  <input
                    id="payment-amount-input"
                    type="text"
                    inputMode="decimal"
                    className="form-input amount-styled-input"
                    placeholder="0.00"
                    value={amount}
                    onChange={handleAmountChange}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Frequency Selector Chips */}
              <div className="form-group">
                <label className="form-label">Frequency</label>
                <div className="frequency-chips-grid">
                  {FREQUENCIES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`frequency-chip ${frequency === f ? 'selected' : ''}`}
                      onClick={() => setFrequency(f)}
                      disabled={isSubmitting}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Next Due Date */}
              <div className="form-group">
                <label htmlFor="payment-date-input" className="form-label">Next Due Date</label>
                <input
                  id="payment-date-input"
                  type="date"
                  className="form-input date-input"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Category Chips */}
              <div className="form-group">
                <label className="form-label">Category</label>
                {categoryOptions.length === 0 ? (
                  <p className="no-options-warning">No active categories found. Please add one in Settings.</p>
                ) : (
                  <div className="category-chips-grid mini">
                    {categoryOptions.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`category-chip ${selectedCategory === cat.name ? 'selected' : ''} ${cat.isInactive ? 'chip-inactive' : ''}`}
                        onClick={() => setSelectedCategory(cat.name)}
                        disabled={isSubmitting}
                      >
                        {cat.name}
                        {cat.isInactive && <span className="chip-inactive-indicator"> (Inactive)</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Method Chips */}
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                {paymentMethodOptions.length === 0 ? (
                  <p className="no-options-warning">No active payment methods found. Please add one in Settings.</p>
                ) : (
                  <div className="payment-chips-grid mini">
                    {paymentMethodOptions.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`payment-chip ${selectedPaymentMethod === m.name ? 'selected' : ''} ${m.isInactive ? 'chip-inactive' : ''}`}
                        onClick={() => setSelectedPaymentMethod(m.name)}
                        disabled={isSubmitting}
                      >
                        {m.name}
                        {m.isInactive && <span className="chip-inactive-indicator"> (Inactive)</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Optional Note */}
              <div className="form-group">
                <label htmlFor="payment-note-input" className="form-label">
                  Optional Note <span className="char-count">({note.length}/120)</span>
                </label>
                <input
                  id="payment-note-input"
                  type="text"
                  className="form-input"
                  placeholder="Details, account reference, or billing info"
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
                  {isSubmitting ? 'Saving...' : editingPayment ? 'Save Changes' : 'Add Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {paymentPendingDelete && (
        <div
          className="modal-backdrop"
          onClick={() => setPaymentPendingDelete(null)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-payment-modal-title"
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 id="delete-payment-modal-title" className="modal-title">Delete Recurring Payment?</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPaymentPendingDelete(null)}
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
                "{paymentPendingDelete.name}"
              </strong>? This action cannot be undone. Pre-existing expenses will remain untouched.
            </p>

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setPaymentPendingDelete(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-delete"
                onClick={() => handleDeletePayment(paymentPendingDelete)}
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
