import React, { useState } from 'react';
import { Tab } from './types';
import { SAMPLE_MONTHS } from './sampleData';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { AddExpenseView } from './components/AddExpenseView';
import { PlaceholderView } from './components/PlaceholderView';
import { EditFinancialModal } from './components/EditFinancialModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [selectedMonthId, setSelectedMonthId] = useState<string>('2026-10');

  // Pure in-memory financial setup state (resets on page refresh, no persistence)
  const [monthlyIncome, setMonthlyIncome] = useState<number | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);

  // Modal editor state for income and budget
  const [editingType, setEditingType] = useState<'income' | 'budget' | null>(null);

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
              months={SAMPLE_MONTHS}
              selectedMonthId={selectedMonthId}
              monthlyIncome={monthlyIncome}
              monthlyBudget={monthlyBudget}
              onSelectMonth={setSelectedMonthId}
              onOpenEditIncome={() => setEditingType('income')}
              onOpenEditBudget={() => setEditingType('budget')}
              onAddExpenseClick={() => handleTabChange('add')}
              onViewAllExpensesClick={() => handleTabChange('expenses')}
            />
          )}

          {activeTab === 'add' && (
            <AddExpenseView onCancel={() => handleTabChange('home')} />
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
