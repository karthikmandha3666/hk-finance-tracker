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
import { PlaceholderView } from './components/PlaceholderView';
import { EditFinancialModal } from './components/EditFinancialModal';
import { expenseRepository } from './repositories/expenseRepository';
import { financialSettingsRepository } from './repositories/financialSettingsRepository';
import { categoryRepository } from './repositories/categoryRepository';
import { paymentMethodRepository } from './repositories/paymentMethodRepository';
import { getLocalCurrentMonthId } from './utils/finance';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  // Dynamically initialize to current local client month (no hardcoded '2026-10')
  const [selectedMonthId, setSelectedMonthId] = useState<string>(getLocalCurrentMonthId);

  // View state for upcoming/recurring payments
  const [viewingUpcoming, setViewingUpcoming] = useState<boolean>(false);

  // Modal editor state for income and budget
  const [editingType, setEditingType] = useState<'income' | 'budget' | null>(null);

  // Selected expense for editing or deletion
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Automatically ensure default categories and payment methods are seeded on launch
  useEffect(() => {
    categoryRepository.ensureDefaults().catch((err) => {
      console.error('Failed to ensure default categories:', err);
    });
    paymentMethodRepository.ensureDefaults().catch((err) => {
      console.error('Failed to ensure default payment methods:', err);
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

      {/* Main App Container */}
      <div className="app-frame">
        {/* Top Header - Always visible with HK branding */}
        <Header onAddClick={() => { setEditingExpense(null); setViewingUpcoming(false); handleTabChange('add'); }} />

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
            <UpcomingPaymentsView onBack={() => setViewingUpcoming(false)} />
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
                  onOpenUpcoming={() => setViewingUpcoming(true)}
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
                <SettingsView onBack={() => handleTabChange('home')} />
              )}

              {(activeTab === 'expenses' || activeTab === 'budgets') && (
                <PlaceholderView
                  tab={activeTab}
                  onGoHome={() => handleTabChange('home')}
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
