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

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  // Dynamically initialize to current local client month (no hardcoded '2026-10')
  const [selectedMonthId, setSelectedMonthId] = useState<string>(getLocalCurrentMonthId);

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

  const handleTabChange = (tab: Tab) => {
    setEditingExpense(null);
    setViewingUpcoming(false);
    setViewingLoans(false);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        <Header onAddClick={() => { setEditingExpense(null); setViewingUpcoming(false); setViewingLoans(false); handleTabChange('add'); }} />

        {/* Dynamic Content Views */}
        <main className="content-area">
          {editingExpense ? (
            <EditExpenseView
              expense={editingExpense}
              onCancel={() => setEditingExpense(null)}
              onExpenseUpdated={() => setEditingExpense(null)}
              onExpenseDeleted={() => setEditingExpense(null)}
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
                  onSelectMonth={setSelectedMonthId}
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
                  onCancel={() => handleTabChange('home')}
                  onExpenseAdded={() => handleTabChange('home')}
                  onNavigateToSettings={() => handleTabChange('more')}
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
                  onSelectMonth={setSelectedMonthId}
                  expenses={expenses}
                  onAddExpenseClick={() => handleTabChange('add')}
                  onEditExpense={(item) => setEditingExpense(item)}
                />
              )}

              {activeTab === 'budgets' && (
                <BudgetsView
                  months={INITIAL_MONTHS}
                  selectedMonthId={selectedMonthId}
                  onSelectMonth={setSelectedMonthId}
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
      </div>
    </div>
  );
};

export default App;
