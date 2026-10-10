import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Tab, Expense } from './types';
import { INITIAL_MONTHS } from './sampleData';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { AddExpenseView } from './components/AddExpenseView';
import { EditExpenseView } from './components/EditExpenseView';
import { SettingsView } from './components/SettingsView';
import { UpcomingPaymentsView } from './components/UpcomingPaymentsView';
import { LoansView } from './components/LoansView';
import { ExpensesView } from './components/ExpensesView';
import { BudgetsView } from './components/BudgetsView';
import { EditFinancialModal } from './components/EditFinancialModal';
import { SplashScreen } from './components/SplashScreen';
import { expenseRepository } from './repositories/expenseRepository';
import { financialSettingsRepository } from './repositories/financialSettingsRepository';
import { categoryRepository } from './repositories/categoryRepository';
import { paymentMethodRepository } from './repositories/paymentMethodRepository';
import { getLocalCurrentMonthId } from './utils/finance';

export const SELECTED_MONTH_STORAGE_KEY = 'spendly_selected_month_id';

const getInitialSelectedMonthId = (): string => {
  try {
    const saved = localStorage.getItem(SELECTED_MONTH_STORAGE_KEY);
    if (saved && /^\d{4}-\d{2}$/.test(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return getLocalCurrentMonthId();
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  // Dynamically initialize to stored or current local client month (no hardcoded '2026-10')
  const [selectedMonthId, setSelectedMonthId] = useState<string>(getInitialSelectedMonthId);

  const handleSelectMonth = (monthId: string) => {
    setSelectedMonthId(monthId);
    try {
      localStorage.setItem(SELECTED_MONTH_STORAGE_KEY, monthId);
    } catch {
      // Ignore storage errors
    }
  };

  // Startup brand splash screen: visible on full page load / browser refresh / PWA launch
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [isAppInitialized, setIsAppInitialized] = useState<boolean>(false);

  // Navigation return target (tracks whether user entered from 'home' or 'more')
  const [returnView, setReturnView] = useState<'home' | 'more'>('home');

  // View state for upcoming/recurring payments
  const [viewingUpcoming, setViewingUpcoming] = useState<boolean>(false);

  // View state for loans & EMI management
  const [viewingLoans, setViewingLoans] = useState<boolean>(false);

  // Modal editor state for income and budget
  const [editingType, setEditingType] = useState<'income' | 'budget' | null>(null);

  // Selected expense for editing or deletion
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Automatically ensure default categories and payment methods on launch without resetting user data
  useEffect(() => {
    Promise.all([
      categoryRepository.ensureDefaults(),
      paymentMethodRepository.ensureDefaults(),
    ])
      .then(() => setIsAppInitialized(true))
      .catch((err) => {
        console.error('Failed to ensure default settings on launch:', err);
        setIsAppInitialized(true);
      });
  }, []);

  // Live query for expenses in the selected month via repository abstraction
  const liveExpenses = useLiveQuery(
    () => expenseRepository.getExpensesByMonth(selectedMonthId),
    [selectedMonthId]
  );
  const expenses = liveExpenses ?? [];

  // Live query for financial settings in the selected month via repository abstraction
  const currentSettings = useLiveQuery(
    () => financialSettingsRepository.getMonthlySettings(selectedMonthId),
    [selectedMonthId]
  );
  const monthlyIncomePaise = currentSettings?.incomeInPaise ?? null;
  const monthlyBudgetPaise = currentSettings?.budgetInPaise ?? null;

  // Accessible PWA Update Notification Listener (MAS-10)
  const [pwaUpdateAvailable, setPwaUpdateAvailable] = useState<boolean>(false);
  const [updateSWHandler, setUpdateSWHandler] = useState<(() => void) | null>(null);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ updateSW?: () => void }>;
      setPwaUpdateAvailable(true);
      if (customEvent.detail?.updateSW) {
        setUpdateSWHandler(() => customEvent.detail.updateSW);
      }
    };
    window.addEventListener('spendly-pwa-update', handleUpdate);
    return () => window.removeEventListener('spendly-pwa-update', handleUpdate);
  }, []);

  // Form dirty state and safe navigation guard (MAS-04)
  const [isFormDirty, setIsFormDirty] = useState<boolean>(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);

  const confirmOrNavigate = (navigateFn: () => void) => {
    if (isFormDirty) {
      setPendingNavigation(() => navigateFn);
      setShowDiscardConfirm(true);
      return;
    }
    navigateFn();
  };

  const handleTabChange = (tab: Tab) => {
    confirmOrNavigate(() => {
      setIsFormDirty(false);
      setEditingExpense(null);
      setViewingUpcoming(false);
      setViewingLoans(false);
      setActiveTab(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handleSaveFinancialValue = async (valInPaise: number | null) => {
    if (editingType === 'income') {
      await financialSettingsRepository.updateMonthlyIncome(selectedMonthId, valInPaise);
    } else if (editingType === 'budget') {
      await financialSettingsRepository.updateMonthlyBudget(selectedMonthId, valInPaise);
    }
  };

  return (
    <div className="mobile-shell">
      {/* App Ambient Glow */}
      <div className="ambient-glow" aria-hidden="true" />

      {/* Accessible PWA Update Notification Banner (MAS-10) */}
      {pwaUpdateAvailable && (
        <div className="pwa-update-banner" role="alert" aria-live="polite">
          <div className="pwa-update-text">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Update available! Reload to run the latest version.</span>
          </div>
          <div className="pwa-update-actions">
            <button
              type="button"
              className="btn-pwa-update"
              onClick={() => {
                if (updateSWHandler) {
                  updateSWHandler();
                } else {
                  window.location.reload();
                }
              }}
            >
              Update
            </button>
            <button
              type="button"
              className="btn-pwa-dismiss"
              onClick={() => setPwaUpdateAvailable(false)}
              aria-label="Dismiss update alert"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Spendly Initial Splash / Brand Screen */}
      {showSplash && (
        <SplashScreen
          isReady={isAppInitialized}
          onDismiss={() => setShowSplash(false)}
        />
      )}

      {/* Main App Container */}
      <div className="app-frame">
        {/* Top Header - Spendly branding */}
        <Header
          onAddClick={() => {
            confirmOrNavigate(() => {
              setIsFormDirty(false);
              setEditingExpense(null);
              setViewingUpcoming(false);
              setViewingLoans(false);
              setActiveTab('add');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            });
          }}
        />

        {/* Dynamic Content Views */}
        <main className="content-area">
          {editingExpense ? (
            <EditExpenseView
              expense={editingExpense}
              onDirtyChange={setIsFormDirty}
              onCancel={() => {
                setIsFormDirty(false);
                setEditingExpense(null);
              }}
              onExpenseUpdated={(updated) => {
                setIsFormDirty(false);
                setEditingExpense(null);
                if (updated && updated.date) {
                  const targetMonthId = updated.date.slice(0, 7);
                  if (targetMonthId !== selectedMonthId) {
                    handleSelectMonth(targetMonthId);
                  }
                  setActiveTab('expenses');
                }
              }}
              onExpenseDeleted={() => {
                setIsFormDirty(false);
                setEditingExpense(null);
              }}
            />
          ) : viewingUpcoming ? (
            <UpcomingPaymentsView
              onBack={() => {
                setViewingUpcoming(false);
                setActiveTab(returnView);
              }}
            />
          ) : viewingLoans ? (
            <LoansView
              onBack={() => {
                setViewingLoans(false);
                setActiveTab(returnView);
              }}
            />
          ) : (
            <>
              {activeTab === 'home' && (
                <HomeView
                  months={INITIAL_MONTHS}
                  selectedMonthId={selectedMonthId}
                  monthlyIncomePaise={monthlyIncomePaise}
                  monthlyBudgetPaise={monthlyBudgetPaise}
                  expenses={expenses}
                  onSelectMonth={handleSelectMonth}
                  onOpenEditIncome={() => setEditingType('income')}
                  onOpenEditBudget={() => setEditingType('budget')}
                  onAddExpenseClick={() => handleTabChange('add')}
                  onViewAllExpensesClick={() => handleTabChange('expenses')}
                  onEditExpense={(item) => setEditingExpense(item)}
                  onOpenUpcoming={() => {
                    setReturnView('home');
                    setViewingUpcoming(true);
                  }}
                  onOpenLoans={() => {
                    setReturnView('home');
                    setViewingLoans(true);
                  }}
                />
              )}

              {activeTab === 'add' && (
                <AddExpenseView
                  onDirtyChange={setIsFormDirty}
                  onCancel={() => {
                    setIsFormDirty(false);
                    setActiveTab('home');
                  }}
                  onExpenseAdded={(newExpense) => {
                    setIsFormDirty(false);
                    if (newExpense && newExpense.date) {
                      const targetMonthId = newExpense.date.slice(0, 7);
                      if (targetMonthId !== selectedMonthId) {
                        handleSelectMonth(targetMonthId);
                      }
                    }
                    setActiveTab('home');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onNavigateToSettings={() => {
                    setIsFormDirty(false);
                    setActiveTab('more');
                  }}
                />
              )}

              {activeTab === 'more' && (
                <SettingsView
                  onBack={() => handleTabChange('home')}
                  onOpenUpcoming={() => {
                    setReturnView('more');
                    setViewingUpcoming(true);
                  }}
                  onOpenLoans={() => {
                    setReturnView('more');
                    setViewingLoans(true);
                  }}
                />
              )}

              {activeTab === 'expenses' && (
                <ExpensesView
                  months={INITIAL_MONTHS}
                  selectedMonthId={selectedMonthId}
                  onSelectMonth={handleSelectMonth}
                  expenses={expenses}
                  onAddExpenseClick={() => handleTabChange('add')}
                  onEditExpense={(item) => setEditingExpense(item)}
                />
              )}

              {activeTab === 'budgets' && (
                <BudgetsView
                  months={INITIAL_MONTHS}
                  selectedMonthId={selectedMonthId}
                  onSelectMonth={handleSelectMonth}
                  monthlyIncomePaise={monthlyIncomePaise}
                  monthlyBudgetPaise={monthlyBudgetPaise}
                  expenses={expenses}
                  onOpenEditIncome={() => setEditingType('income')}
                  onOpenEditBudget={() => setEditingType('budget')}
                  onAddExpenseClick={() => handleTabChange('add')}
                />
              )}
            </>
          )}
        </main>

        {/* Bottom Navigation Bar */}
        <BottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        {/* Persistent Income & Budget Edit Modal */}
        <EditFinancialModal
          isOpen={editingType !== null}
          type={editingType || 'income'}
          currentValueInPaise={editingType === 'income' ? monthlyIncomePaise : monthlyBudgetPaise}
          onSave={handleSaveFinancialValue}
          onClose={() => setEditingType(null)}
        />

        {/* Discard Unsaved Changes Modal (MAS-04) */}
        {showDiscardConfirm && (
          <div
            className="modal-backdrop"
            onClick={() => {
              setShowDiscardConfirm(false);
              setPendingNavigation(null);
            }}
            role="presentation"
          >
            <div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="discard-form-modal-title"
            >
              <div className="modal-header">
                <div className="modal-title-group">
                  <h3 id="discard-form-modal-title" className="modal-title">Discard Unsaved Form?</h3>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    setPendingNavigation(null);
                  }}
                  aria-label="Close dialog"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <p className="modal-desc">
                You have unsaved details in your form. If you navigate away now, your entered data will be discarded.
              </p>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    setPendingNavigation(null);
                  }}
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  className="btn-modal-delete"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    setIsFormDirty(false);
                    if (pendingNavigation) {
                      pendingNavigation();
                      setPendingNavigation(null);
                    }
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
