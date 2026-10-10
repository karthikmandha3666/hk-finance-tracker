import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Category, PaymentMethod } from '../types';
import { categoryRepository } from '../repositories/categoryRepository';
import { paymentMethodRepository } from '../repositories/paymentMethodRepository';
import { recurringPaymentRepository } from '../repositories/recurringPaymentRepository';
import { loanRepository } from '../repositories/loanRepository';

interface SettingsViewProps {
  onBack: () => void;
  onOpenUpcoming: () => void;
  onOpenLoans: () => void;
}

type SettingsSection = 'categories' | 'paymentMethods';

export const SettingsView: React.FC<SettingsViewProps> = ({
  onBack,
  onOpenUpcoming,
  onOpenLoans,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('categories');

  // Modal dialog states
  const [modalMode, setModalMode] = useState<'add-category' | 'rename-category' | 'add-payment' | 'rename-payment' | null>(null);
  const [targetCategory, setTargetCategory] = useState<Category | null>(null);
  const [targetPayment, setTargetPayment] = useState<PaymentMethod | null>(null);
  const [formInput, setFormInput] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Deactivate confirmation modal
  const [deactivateCategoryTarget, setDeactivateCategoryTarget] = useState<Category | null>(null);
  const [deactivatePaymentTarget, setDeactivatePaymentTarget] = useState<PaymentMethod | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Reactive data queries
  const allCategories = useLiveQuery(() => categoryRepository.getCategories()) ?? [];
  const allPaymentMethods = useLiveQuery(() => paymentMethodRepository.getPaymentMethods()) ?? [];

  const activeCategories = allCategories.filter((c) => c.isActive);
  const inactiveCategories = allCategories.filter((c) => !c.isActive);

  const activePaymentMethods = allPaymentMethods.filter((m) => m.isActive);
  const inactivePaymentMethods = allPaymentMethods.filter((m) => !m.isActive);

  // Live queries for navigation hub module summaries
  const upcomingPayments = useLiveQuery(() => recurringPaymentRepository.getUpcomingPayments()) ?? [];
  const activeLoans = useLiveQuery(() => loanRepository.getActiveLoans()) ?? [];

  // --- Handlers for Categories ---
  const handleOpenAddCategory = () => {
    setFormInput('');
    setFormError(null);
    setModalMode('add-category');
  };

  const handleOpenRenameCategory = (cat: Category) => {
    setTargetCategory(cat);
    setFormInput(cat.name);
    setFormError(null);
    setModalMode('rename-category');
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = formInput.trim();
    if (!trimmed) {
      setFormError('Category name cannot be empty.');
      return;
    }
    if (trimmed.length > 50) {
      setFormError('Category name cannot exceed 50 characters.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      if (modalMode === 'add-category') {
        await categoryRepository.addCategory(trimmed);
      } else if (modalMode === 'rename-category' && targetCategory) {
        await categoryRepository.updateCategory(targetCategory.id, trimmed);
      }
      setModalMode(null);
      setTargetCategory(null);
      setFormInput('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeactivateCategory = async () => {
    if (!deactivateCategoryTarget || isSubmitting) return;
    setIsSubmitting(true);
    setGeneralError(null);
    try {
      await categoryRepository.deactivateCategory(deactivateCategoryTarget.id);
      setDeactivateCategoryTarget(null);
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to deactivate category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivateCategory = async (cat: Category) => {
    setGeneralError(null);
    try {
      await categoryRepository.reactivateCategory(cat.id);
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to reactivate category.');
    }
  };

  // --- Handlers for Payment Methods ---
  const handleOpenAddPayment = () => {
    setFormInput('');
    setFormError(null);
    setModalMode('add-payment');
  };

  const handleOpenRenamePayment = (pm: PaymentMethod) => {
    setTargetPayment(pm);
    setFormInput(pm.name);
    setFormError(null);
    setModalMode('rename-payment');
  };

  const handleSavePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = formInput.trim();
    if (!trimmed) {
      setFormError('Payment method name cannot be empty.');
      return;
    }
    if (trimmed.length > 50) {
      setFormError('Payment method name cannot exceed 50 characters.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      if (modalMode === 'add-payment') {
        await paymentMethodRepository.addPaymentMethod(trimmed);
      } else if (modalMode === 'rename-payment' && targetPayment) {
        await paymentMethodRepository.updatePaymentMethod(targetPayment.id, trimmed);
      }
      setModalMode(null);
      setTargetPayment(null);
      setFormInput('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save payment method.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeactivatePayment = async () => {
    if (!deactivatePaymentTarget || isSubmitting) return;
    setIsSubmitting(true);
    setGeneralError(null);
    try {
      await paymentMethodRepository.deactivatePaymentMethod(deactivatePaymentTarget.id);
      setDeactivatePaymentTarget(null);
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to deactivate payment method.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivatePayment = async (pm: PaymentMethod) => {
    setGeneralError(null);
    try {
      await paymentMethodRepository.reactivatePaymentMethod(pm.id);
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to reactivate payment method.');
    }
  };

  return (
    <div className="settings-view">
      {/* Header */}
      <div className="view-header">
        <button
          type="button"
          className="btn-icon-back"
          onClick={onBack}
          aria-label="Back to Home"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 className="view-title">More & Settings</h2>
        <div className="header-placeholder" />
      </div>

      {generalError && (
        <div className="save-error-box mb-3" role="alert">
          <p>{generalError}</p>
        </div>
      )}

      {/* Spendly Brand Banner */}
      <div className="more-brand-card">
        <div className="more-brand-top">
          <div className="more-brand-badge" aria-hidden="true">HK</div>
          <div className="more-brand-info">
            <h3 className="more-brand-name">Spendly</h3>
            <span className="more-brand-version">v0.1.0 • Local-First</span>
          </div>
        </div>
        <p className="more-brand-tagline">Spend smart. Live better. Make every rupee count.</p>
      </div>

      {/* Permanent Navigation Hub: Stage 7 and Stage 8 Modules */}
      <div className="more-hub-section">
        <span className="more-hub-section-title">Financial Modules</span>
        <div className="more-hub-grid">
          {/* Upcoming Obligations Card */}
          <button
            type="button"
            className="more-hub-card"
            onClick={onOpenUpcoming}
            aria-label={`Upcoming Payments: ${upcomingPayments.length} upcoming obligations`}
          >
            <div className="more-hub-card-left">
              <div className="more-hub-icon-box upcoming" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div className="more-hub-card-text">
                <span className="more-hub-card-title">Upcoming Obligations</span>
                <span className="more-hub-card-desc">Recurring bills, subscriptions & dues</span>
              </div>
            </div>
            <div className="more-hub-card-right">
              <span className="more-hub-badge">{upcomingPayments.length} due</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </button>

          {/* Loans & EMI Card */}
          <button
            type="button"
            className="more-hub-card"
            onClick={onOpenLoans}
            aria-label={`Loans and EMI Management: ${activeLoans.length} active loans`}
          >
            <div className="more-hub-card-left">
              <div className="more-hub-icon-box loan" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <div className="more-hub-card-text">
                <span className="more-hub-card-title">Loans & EMI</span>
                <span className="more-hub-card-desc">Liabilities, tenure & repayments</span>
              </div>
            </div>
            <div className="more-hub-card-right">
              <span className="more-hub-badge">{activeLoans.length} active</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      <div className="more-divider" />

      {/* Section Switcher Tabs: Categories & Payment Methods */}
      <div className="settings-section-tabs">
        <button
          type="button"
          className={`settings-tab-btn ${activeSection === 'categories' ? 'active' : ''}`}
          onClick={() => { setActiveSection('categories'); setGeneralError(null); }}
        >
          Categories ({activeCategories.length})
        </button>
        <button
          type="button"
          className={`settings-tab-btn ${activeSection === 'paymentMethods' ? 'active' : ''}`}
          onClick={() => { setActiveSection('paymentMethods'); setGeneralError(null); }}
        >
          Payment Methods ({activePaymentMethods.length})
        </button>
      </div>

      {/* --- CATEGORIES SECTION --- */}
      {activeSection === 'categories' && (
        <div className="settings-content-pane">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-pane-title">Expense Categories</h3>
              <p className="settings-pane-subtitle">Manage categories for tagging expenses</p>
            </div>
            <button
              type="button"
              className="btn-add-setting-item"
              onClick={handleOpenAddCategory}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add Category</span>
            </button>
          </div>

          {/* Active Categories List */}
          <div className="settings-card">
            <div className="settings-card-label">Active Categories</div>
            {activeCategories.length === 0 ? (
              <p className="settings-empty-hint">No active categories. Add one above.</p>
            ) : (
              <div className="settings-item-list">
                {activeCategories.map((cat) => (
                  <div key={cat.id} className="settings-item-row">
                    <div className="settings-name-wrapper">
                      <span className="settings-item-name" title={cat.name}>{cat.name}</span>
                    </div>
                    <div className="settings-item-actions">
                      <button
                        type="button"
                        className="btn-setting-action rename"
                        onClick={() => handleOpenRenameCategory(cat)}
                        title="Rename"
                        aria-label={`Rename ${cat.name}`}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                        <span>Rename</span>
                      </button>
                      <button
                        type="button"
                        className="btn-setting-action deactivate"
                        onClick={() => setDeactivateCategoryTarget(cat)}
                        title="Deactivate"
                        aria-label={`Deactivate ${cat.name}`}
                      >
                        <span>Deactivate</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inactive Categories List */}
          {inactiveCategories.length > 0 && (
            <div className="settings-card inactive-card">
              <div className="settings-card-label">
                Inactive Categories ({inactiveCategories.length})
                <span className="settings-card-hint">Historical expenses remain intact</span>
              </div>
              <div className="settings-item-list">
                {inactiveCategories.map((cat) => (
                  <div key={cat.id} className="settings-item-row inactive-row">
                    <div className="settings-name-wrapper">
                      <span className="settings-item-name inactive" title={cat.name}>{cat.name}</span>
                      <span className="inactive-badge">Inactive</span>
                    </div>
                    <div className="settings-item-actions">
                      <button
                        type="button"
                        className="btn-setting-action rename"
                        onClick={() => handleOpenRenameCategory(cat)}
                        title="Rename"
                        aria-label={`Rename ${cat.name}`}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                        <span>Rename</span>
                      </button>
                      <button
                        type="button"
                        className="btn-setting-action reactivate"
                        onClick={() => handleReactivateCategory(cat)}
                        aria-label={`Reactivate ${cat.name}`}
                      >
                        Reactivate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- PAYMENT METHODS SECTION --- */}
      {activeSection === 'paymentMethods' && (
        <div className="settings-content-pane">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-pane-title">Payment Methods</h3>
              <p className="settings-pane-subtitle">Manage payment modes for expenses</p>
            </div>
            <button
              type="button"
              className="btn-add-setting-item"
              onClick={handleOpenAddPayment}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add Method</span>
            </button>
          </div>

          {/* Active Payment Methods List */}
          <div className="settings-card">
            <div className="settings-card-label">Active Payment Methods</div>
            {activePaymentMethods.length === 0 ? (
              <p className="settings-empty-hint">No active payment methods. Add one above.</p>
            ) : (
              <div className="settings-item-list">
                {activePaymentMethods.map((pm) => (
                  <div key={pm.id} className="settings-item-row">
                    <div className="settings-name-wrapper">
                      <span className="settings-item-name" title={pm.name}>{pm.name}</span>
                    </div>
                    <div className="settings-item-actions">
                      <button
                        type="button"
                        className="btn-setting-action rename"
                        onClick={() => handleOpenRenamePayment(pm)}
                        title="Rename"
                        aria-label={`Rename ${pm.name}`}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                        <span>Rename</span>
                      </button>
                      <button
                        type="button"
                        className="btn-setting-action deactivate"
                        onClick={() => setDeactivatePaymentTarget(pm)}
                        title="Deactivate"
                        aria-label={`Deactivate ${pm.name}`}
                      >
                        <span>Deactivate</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inactive Payment Methods List */}
          {inactivePaymentMethods.length > 0 && (
            <div className="settings-card inactive-card">
              <div className="settings-card-label">
                Inactive Payment Methods ({inactivePaymentMethods.length})
                <span className="settings-card-hint">Historical expenses remain intact</span>
              </div>
              <div className="settings-item-list">
                {inactivePaymentMethods.map((pm) => (
                  <div key={pm.id} className="settings-item-row inactive-row">
                    <div className="settings-name-wrapper">
                      <span className="settings-item-name inactive" title={pm.name}>{pm.name}</span>
                      <span className="inactive-badge">Inactive</span>
                    </div>
                    <div className="settings-item-actions">
                      <button
                        type="button"
                        className="btn-setting-action rename"
                        onClick={() => handleOpenRenamePayment(pm)}
                        title="Rename"
                        aria-label={`Rename ${pm.name}`}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                        <span>Rename</span>
                      </button>
                      <button
                        type="button"
                        className="btn-setting-action reactivate"
                        onClick={() => handleReactivatePayment(pm)}
                        aria-label={`Reactivate ${pm.name}`}
                      >
                        Reactivate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- ADD / RENAME MODAL --- */}
      {modalMode !== null && (
        <div
          className="modal-backdrop"
          onClick={() => !isSubmitting && setModalMode(null)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
          >
            <div className="modal-header">
              <h3 id="settings-modal-title" className="modal-title">
                {modalMode === 'add-category' && 'Add Category'}
                {modalMode === 'rename-category' && 'Rename Category'}
                {modalMode === 'add-payment' && 'Add Payment Method'}
                {modalMode === 'rename-payment' && 'Rename Payment Method'}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isSubmitting && setModalMode(null)}
                aria-label="Close"
                disabled={isSubmitting}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={modalMode.includes('category') ? handleSaveCategory : handleSavePaymentMethod}>
              <div className="form-group mb-3">
                <label htmlFor="setting-name-input" className="form-label">
                  Name <span className="char-count">({formInput.length}/50)</span>
                </label>
                <input
                  id="setting-name-input"
                  type="text"
                  className="form-input"
                  placeholder={modalMode.includes('category') ? 'e.g. Groceries' : 'e.g. Sodexo'}
                  maxLength={50}
                  value={formInput}
                  onChange={(e) => {
                    setFormInput(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>

              {formError && (
                <p className="modal-error-text mb-3" role="alert">
                  {formError}
                </p>
              )}

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setModalMode(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-save"
                  disabled={isSubmitting || formInput.trim() === ''}
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DEACTIVATE CATEGORY CONFIRMATION MODAL --- */}
      {deactivateCategoryTarget !== null && (
        <div
          className="modal-backdrop"
          onClick={() => !isSubmitting && setDeactivateCategoryTarget(null)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-cat-title"
          >
            <div className="modal-header">
              <h3 id="deactivate-cat-title" className="modal-title">Deactivate Category?</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isSubmitting && setDeactivateCategoryTarget(null)}
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
              Are you sure you want to deactivate{' '}
              <strong style={{ color: '#f8fafc' }}>{deactivateCategoryTarget.name}</strong>?
              It will no longer appear when creating new expenses. Existing historical records will remain safe and continue displaying this category.
            </p>

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setDeactivateCategoryTarget(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-delete"
                onClick={handleConfirmDeactivateCategory}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DEACTIVATE PAYMENT METHOD CONFIRMATION MODAL --- */}
      {deactivatePaymentTarget !== null && (
        <div
          className="modal-backdrop"
          onClick={() => !isSubmitting && setDeactivatePaymentTarget(null)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-pm-title"
          >
            <div className="modal-header">
              <h3 id="deactivate-pm-title" className="modal-title">Deactivate Payment Method?</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isSubmitting && setDeactivatePaymentTarget(null)}
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
              Are you sure you want to deactivate{' '}
              <strong style={{ color: '#f8fafc' }}>{deactivatePaymentTarget.name}</strong>?
              It will no longer appear when creating new expenses. Existing historical records will remain safe and continue displaying this payment method.
            </p>

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setDeactivatePaymentTarget(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-delete"
                onClick={handleConfirmDeactivatePayment}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
