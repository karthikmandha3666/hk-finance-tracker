import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Tab } from './types';
import { INITIAL_MONTHS } from './sampleData';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { AddExpenseView } from './components/AddExpenseView';
import { PlaceholderView } from './components/PlaceholderView';
import { EditFinancialModal } from './components/EditFinancialModal';
import { expenseRepository } from './repositories/expenseRepository';
import { getLocalCurrentMonthId } from './utils/finance';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  // Dynamically initialize to current local client month (no hardcoded '2026-10')
  const [selectedMonthId, setSelectedMonthId] = useState<string>(getLocalCurrentMonthId);

  // Pure in-memory financial setup state (resets on page refresh, no persistence)
  const [monthlyIncome, setMonthlyIncome] = useState<number | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);

  // Modal editor state for income and budget
  const [editingType, setEditingType] = useState<'income' | 'budget' | null>(null);

  // Live query for expenses in the selected month via repository abstraction
  const liveExpenses = useLiveQuery(
    () => expenseRepository.getExpensesByMonth(selectedMonthId),
    [selectedMonthId]
  );
  const expenses = liveExpenses ?? [];

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveFinancialValue = (val: number | null) => {
    if (editingType === 'income') {
      setMonthlyIncome(val);
    } else if (editingType === 'budget') {
      setMonthlyBudget(val);
    }
  };

  return (
    <div className="mobile-shell">
      {/* App Ambient Glow */}
      <div className="ambient-glow" aria-hidden="true" />

      {/* Main App Container */}
      <div className="app-frame">
        {/* Top Header - Always visible with HK branding */}
        <Header onAddClick={() => handleTabChange('add')} />

        {/* Dynamic Content Views */}
        <main className="content-area">
          {activeTab === 'home' && (
            <HomeView
              months={INITIAL_MONTHS}
              selectedMonthId={selectedMonthId}
              monthlyIncome={monthlyIncome}
              monthlyBudget={monthlyBudget}
              expenses={expenses}
              onSelectMonth={setSelectedMonthId}
              onOpenEditIncome={() => setEditingType('income')}
              onOpenEditBudget={() => setEditingType('budget')}
              onAddExpenseClick={() => handleTabChange('add')}
              onViewAllExpensesClick={() => handleTabChange('expenses')}
            />
          )}

          {activeTab === 'add' && (
            <AddExpenseView
              onCancel={() => handleTabChange('home')}
              onExpenseAdded={() => handleTabChange('home')}
            />
          )}

          {(activeTab === 'expenses' || activeTab === 'budgets' || activeTab === 'more') && (
            <PlaceholderView
              tab={activeTab}
              onGoHome={() => handleTabChange('home')}
            />
          )}
        </main>

        {/* Bottom Navigation Bar */}
        <BottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        {/* In-Memory Income & Budget Edit Modal */}
        <EditFinancialModal
          isOpen={editingType !== null}
          type={editingType || 'income'}
          currentValue={editingType === 'income' ? monthlyIncome : monthlyBudget}
          onSave={handleSaveFinancialValue}
          onClose={() => setEditingType(null)}
        />
      </div>
    </div>
  );
};

export default App;
