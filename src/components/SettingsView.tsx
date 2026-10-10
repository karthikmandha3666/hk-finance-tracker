import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Category, PaymentMethod } from '../types';
import { categoryRepository } from '../repositories/categoryRepository';
import { paymentMethodRepository } from '../repositories/paymentMethodRepository';
import { recurringPaymentRepository } from '../repositories/recurringPaymentRepository';
import { loanRepository } from '../repositories/loanRepository';
import {
  exportBackupData,
  downloadBackupFile,
  validateBackupPayload,
  restoreBackupData,
  BackupDataEnvelope,
  ValidationResult,
} from '../utils/backup';
import {
  exportExpensesToCsv,
  downloadCsvFile,
  parseExpensesCsv,
  detectDuplicateExpenses,
  importExpensesToDatabase,
  CsvParseResult,
  DuplicateDetectionResult,
} from '../utils/csv';
import { db } from '../db/db';

interface SettingsViewProps {
  onBack: () => void;
  onOpenUpcoming: () => void;
  onOpenLoans: () => void;
}

type SettingsSection = 'categories' | 'paymentMethods' | 'backup';

export const SettingsView: React.FC<SettingsViewProps> = ({
  onBack,
  onOpenUpcoming,
  onOpenLoans,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('categories');

  // Backup & Restore states (MAS-18)
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);
  const [backupErrorMsg, setBackupErrorMsg] = useState<string | null>(null);
  const [pendingRestoreEnvelope, setPendingRestoreEnvelope] = useState<BackupDataEnvelope | null>(null);
  const [pendingValidation, setPendingValidation] = useState<ValidationResult | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // CSV Export & Import states (Stage 10)
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);
  const [pendingCsvResult, setPendingCsvResult] = useState<CsvParseResult | null>(null);
  const [pendingDuplicateCheck, setPendingDuplicateCheck] = useState<DuplicateDetectionResult | null>(null);
  const [isImportingCsv, setIsImportingCsv] = useState<boolean>(false);

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
  const allExpenses = useLiveQuery(() => db.expenses.toArray()) ?? [];

  // Handlers for CSV Export & Import (Stage 10)
  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    setBackupErrorMsg(null);
    try {
      const csvContent = exportExpensesToCsv(allExpenses);
      downloadCsvFile(csvContent);
      setBackupSuccessMsg(`Exported ${allExpenses.length} expenses to CSV successfully.`);
      setTimeout(() => setBackupSuccessMsg(null), 4000);
    } catch (err) {
      console.error('CSV export failed:', err);
      setBackupErrorMsg('Failed to export expenses to CSV. Please try again.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleFileSelectForCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackupErrorMsg(null);
    setBackupSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parseResult = parseExpensesCsv(text);
        if (parseResult.validRows.length === 0 && parseResult.errors.length > 0 && parseResult.totalRows === 0) {
          setBackupErrorMsg(parseResult.errors[0].reason);
          return;
        }
        const duplicateCheck = detectDuplicateExpenses(parseResult.validRows, allExpenses);
        setPendingCsvResult(parseResult);
        setPendingDuplicateCheck(duplicateCheck);
      } catch (err) {
        console.error('CSV parse error:', err);
        setBackupErrorMsg('Failed to read CSV file. Please ensure it is a valid UTF-8 CSV.');
      } finally {
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      setBackupErrorMsg('Failed to read selected CSV file.');
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvImport = async (importOnlyUnique: boolean) => {
    if (!pendingCsvResult || !pendingDuplicateCheck || isImportingCsv) return;
    setIsImportingCsv(true);
    setBackupErrorMsg(null);
    try {
      const rowsToImport = importOnlyUnique
        ? pendingDuplicateCheck.uniqueRows
        : pendingCsvResult.validRows;
      const res = await importExpensesToDatabase(rowsToImport, db);
      setBackupSuccessMsg(`Successfully imported ${res.importedCount} expenses!`);
      setPendingCsvResult(null);
      setPendingDuplicateCheck(null);
      setTimeout(() => setBackupSuccessMsg(null), 5000);
    } catch (err) {
      console.error('CSV import failed:', err);
      setBackupErrorMsg('Failed to import expenses to database.');
    } finally {
      setIsImportingCsv(false);
    }
  };

  // Handlers for Backup & Restore (MAS-18)
  const handleExportBackup = async () => {
    setIsExporting(true);
    setBackupErrorMsg(null);
    try {
      const envelope = await exportBackupData(db);
      downloadBackupFile(envelope);
      setBackupSuccessMsg('Backup downloaded successfully. Keep this file safe.');
      setTimeout(() => setBackupSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Backup export failed:', err);
      setBackupErrorMsg('Failed to export backup. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelectForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackupErrorMsg(null);
    setBackupSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const validation = validateBackupPayload(parsed);
        if (!validation.isValid) {
          setBackupErrorMsg(validation.error || 'Invalid backup file.');
          return;
        }
        setPendingRestoreEnvelope(parsed as BackupDataEnvelope);
        setPendingValidation(validation);
      } catch {
        setBackupErrorMsg('Unable to parse file. Please upload a valid JSON backup file.');
      } finally {
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      setBackupErrorMsg('Failed to read the selected file.');
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestoreEnvelope || isRestoring) return;
    setIsRestoring(true);
    setBackupErrorMsg(null);
    try {
      await restoreBackupData(db, pendingRestoreEnvelope);
      setPendingRestoreEnvelope(null);
      setPendingValidation(null);
      setBackupSuccessMsg('Data restored successfully! All records updated.');
      setTimeout(() => setBackupSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Restore failed:', err);
      setBackupErrorMsg(err instanceof Error ? err.message : 'Restore failed.');
    } finally {
      setIsRestoring(false);
    }
  };

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
          onClick={() => { setActiveSection('categories'); setGeneralError(null); setBackupErrorMsg(null); setBackupSuccessMsg(null); }}
        >
          Categories ({activeCategories.length})
        </button>
        <button
          type="button"
          className={`settings-tab-btn ${activeSection === 'paymentMethods' ? 'active' : ''}`}
          onClick={() => { setActiveSection('paymentMethods'); setGeneralError(null); setBackupErrorMsg(null); setBackupSuccessMsg(null); }}
        >
          Payment Methods ({activePaymentMethods.length})
        </button>
        <button
          type="button"
          className={`settings-tab-btn ${activeSection === 'backup' ? 'active' : ''}`}
          onClick={() => { setActiveSection('backup'); setGeneralError(null); setBackupErrorMsg(null); setBackupSuccessMsg(null); }}
        >
          Backup & Restore
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

      {/* --- BACKUP & RESTORE SECTION (MAS-18) --- */}
      {activeSection === 'backup' && (
        <div className="settings-content-pane">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-pane-title">Data Backup & Restore</h3>
              <p className="settings-pane-subtitle">Export your records or restore from a backup</p>
            </div>
          </div>

          {backupSuccessMsg && (
            <div className="backup-alert-success" role="status" aria-live="polite">
              ✓ {backupSuccessMsg}
            </div>
          )}

          {backupErrorMsg && (
            <div className="backup-alert-error" role="alert">
              ✕ {backupErrorMsg}
            </div>
          )}

          <div className="backup-pane-container">
            {/* Export Card */}
            <div className="backup-card">
              <div className="backup-card-header">
                <div className="backup-card-icon export" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <h4 className="backup-card-title">Download Backup</h4>
              </div>
              <p className="backup-card-desc">
                Spendly is 100% offline and stores your data securely on this device. Save a copy of all your expenses, budgets, categories, obligations, and loans to your device as a JSON file.
              </p>
              <button
                type="button"
                className="btn-backup-action export"
                onClick={handleExportBackup}
                disabled={isExporting}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>{isExporting ? 'Exporting...' : 'Export Backup File'}</span>
              </button>
            </div>

            {/* Restore Card */}
            <div className="backup-card">
              <div className="backup-card-header">
                <div className="backup-card-icon restore" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <h4 className="backup-card-title">Restore from Backup</h4>
              </div>
              <p className="backup-card-desc">
                Restore your financial data from a previously exported Spendly backup JSON file. All records will be verified and restored atomically.
              </p>
              <label className="btn-backup-action restore-select">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Choose Backup JSON File</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelectForRestore}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* CSV / Excel Export Card (Stage 10) */}
            <div className="backup-card">
              <div className="backup-card-header">
                <div className="backup-card-icon export" aria-hidden="true" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <h4 className="backup-card-title">Export to CSV (Excel)</h4>
              </div>
              <p className="backup-card-desc">
                Export all your expenses into a spreadsheet-ready CSV file formatted with UTF-8 BOM so it opens directly in Microsoft Excel, Google Sheets, or Apple Numbers.
              </p>
              <button
                type="button"
                className="btn-backup-action"
                onClick={handleExportCsv}
                disabled={isExportingCsv}
                style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)', color: '#ffffff' }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>{isExportingCsv ? 'Exporting CSV...' : `Export ${allExpenses.length} Expenses to CSV`}</span>
              </button>
            </div>

            {/* CSV Import Card (Stage 10) */}
            <div className="backup-card">
              <div className="backup-card-header">
                <div className="backup-card-icon restore" aria-hidden="true" style={{ background: 'rgba(56, 189, 248, 0.12)', color: 'var(--accent-cyan)' }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <h4 className="backup-card-title">Import Expenses from CSV</h4>
              </div>
              <p className="backup-card-desc">
                Import expenses from a CSV file (Date, Amount, Category, Payment Method, Note). Preview rows, validate columns, and check for duplicates before writing.
              </p>
              <label className="btn-backup-action restore-select" style={{ background: 'rgba(56, 189, 248, 0.12)', borderColor: 'rgba(56, 189, 248, 0.3)', color: 'var(--accent-cyan)' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Choose Expenses CSV File</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelectForCsvImport}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
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

      {/* Restore Confirmation Modal (MAS-18) */}
      {pendingRestoreEnvelope && pendingValidation && (
        <div
          className="modal-backdrop"
          onClick={() => !isRestoring && setPendingRestoreEnvelope(null)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-modal-title"
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 id="restore-modal-title" className="modal-title">Restore Data from Backup?</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isRestoring && setPendingRestoreEnvelope(null)}
                aria-label="Close dialog"
                disabled={isRestoring}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="modal-desc">
              The backup file was verified successfully. Restoring will <strong>replace all existing records</strong> with the data in this backup:
            </p>

            <div className="backup-counts-summary">
              <div className="backup-count-item">
                <span>Expenses:</span>
                <strong>{pendingValidation.counts?.expenses ?? 0}</strong>
              </div>
              <div className="backup-count-item">
                <span>Categories:</span>
                <strong>{pendingValidation.counts?.categories ?? 0}</strong>
              </div>
              <div className="backup-count-item">
                <span>Payment Methods:</span>
                <strong>{pendingValidation.counts?.paymentMethods ?? 0}</strong>
              </div>
              <div className="backup-count-item">
                <span>Obligations:</span>
                <strong>{pendingValidation.counts?.recurringPayments ?? 0}</strong>
              </div>
              <div className="backup-count-item">
                <span>Loans:</span>
                <strong>{pendingValidation.counts?.loans ?? 0}</strong>
              </div>
              <div className="backup-count-item">
                <span>Budgets:</span>
                <strong>{pendingValidation.counts?.monthlySettings ?? 0}</strong>
              </div>
            </div>

            <p className="modal-hint-text" style={{ color: '#fbbf24' }}>
              ⚠️ Tip: If you want to keep your current data, download a backup first before confirming.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleExportBackup}
                disabled={isRestoring}
              >
                Download Current Backup First
              </button>
              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setPendingRestoreEnvelope(null)}
                  disabled={isRestoring}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-modal-delete"
                  onClick={handleConfirmRestore}
                  disabled={isRestoring}
                >
                  {isRestoring ? 'Restoring...' : 'Confirm & Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Preview Modal (Stage 10) */}
      {pendingCsvResult && pendingDuplicateCheck && (
        <div
          className="modal-backdrop"
          onClick={() => !isImportingCsv && setPendingCsvResult(null)}
          role="presentation"
        >
          <div
            className="modal-card"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="csv-import-modal-title"
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 id="csv-import-modal-title" className="modal-title">Import Expenses Preview</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isImportingCsv && setPendingCsvResult(null)}
                aria-label="Close dialog"
                disabled={isImportingCsv}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="modal-desc">
              Found <strong>{pendingCsvResult.totalRows}</strong> expense rows in the CSV file. Review the validation summary below:
            </p>

            {/* Validation Counts Summary */}
            <div className="backup-counts-summary" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="backup-count-item">
                <span>Valid to Import:</span>
                <strong style={{ color: '#10b981' }}>{pendingCsvResult.validRows.length}</strong>
              </div>
              <div className="backup-count-item">
                <span>Unique Records:</span>
                <strong style={{ color: 'var(--accent-cyan)' }}>{pendingDuplicateCheck.uniqueRows.length}</strong>
              </div>
              <div className="backup-count-item">
                <span>Duplicates:</span>
                <strong style={{ color: '#f59e0b' }}>{pendingDuplicateCheck.duplicateRows.length}</strong>
              </div>
              <div className="backup-count-item">
                <span>Errors / Invalid:</span>
                <strong style={{ color: '#fb7185' }}>{pendingCsvResult.errors.length}</strong>
              </div>
            </div>

            {/* Parsing Errors Notice if any */}
            {pendingCsvResult.errors.length > 0 && (
              <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '10px', padding: '10px 12px', maxHeight: '100px', overflowY: 'auto' }}>
                <p style={{ color: '#fb7185', fontSize: '0.76rem', fontWeight: 700, margin: '0 0 4px 0' }}>
                  {pendingCsvResult.errors.length} invalid row(s) skipped:
                </p>
                <ul style={{ margin: 0, paddingLeft: '16px', color: '#fda4af', fontSize: '0.72rem', lineHeight: '1.4' }}>
                  {pendingCsvResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>Row {err.rowNumber}: {err.reason}</li>
                  ))}
                  {pendingCsvResult.errors.length > 5 && (
                    <li>...and {pendingCsvResult.errors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Duplicate Notice if any */}
            {pendingDuplicateCheck.duplicateRows.length > 0 && (
              <p className="modal-hint-text" style={{ color: '#fbbf24', margin: 0 }}>
                ⚠️ Notice: {pendingDuplicateCheck.duplicateRows.length} rows match existing expenses already saved in Spendly. You can choose to import only unique rows or import all.
              </p>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              {pendingDuplicateCheck.duplicateRows.length > 0 && pendingDuplicateCheck.uniqueRows.length > 0 && (
                <button
                  type="button"
                  className="btn-backup-action"
                  onClick={() => handleConfirmCsvImport(true)}
                  disabled={isImportingCsv}
                  style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)', color: '#ffffff' }}
                >
                  {isImportingCsv ? 'Importing...' : `Import Unique Only (${pendingDuplicateCheck.uniqueRows.length} Expenses)`}
                </button>
              )}

              <button
                type="button"
                className="btn-backup-action"
                onClick={() => handleConfirmCsvImport(false)}
                disabled={isImportingCsv || pendingCsvResult.validRows.length === 0}
                style={{ background: 'rgba(56, 189, 248, 0.16)', border: '1px solid rgba(56, 189, 248, 0.4)', color: 'var(--accent-cyan)' }}
              >
                {isImportingCsv ? 'Importing...' : `Import All Valid (${pendingCsvResult.validRows.length} Expenses)`}
              </button>

              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setPendingCsvResult(null)}
                disabled={isImportingCsv}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
