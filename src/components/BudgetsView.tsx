import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Expense, MonthData } from '../types';
import { MonthSelector } from './MonthSelector';
import { expenseRepository } from '../repositories/expenseRepository';
import { financialSettingsRepository } from '../repositories/financialSettingsRepository';
import {
  formatPaiseToRupees,
  sumExpenses,
  calculateBudgetMetrics,
  getPreviousMonthId,
} from '../utils/finance';
import {
  analyzeCategoryBudgets,
  calculateMonthlyBudgetComparison,
} from '../utils/budgets';

export interface BudgetsViewProps {
  months: MonthData[];
  selectedMonthId: string;
  monthlyIncomePaise: number | null;
  monthlyBudgetPaise: number | null;
  expenses: Expense[];
  onSelectMonth: (monthId: string) => void;
  onOpenEditIncome: () => void;
  onOpenEditBudget: () => void;
  onAddExpenseClick: () => void;
}

const getCategoryIconClass = (cat: string): string => {
  switch (cat) {
    case 'Food': return 'food';
    case 'Travel': return 'travel';
    case 'Coffee & Snacks':
    case 'Coffee/Snacks':
      return 'coffee';
    case 'Bills': return 'bills';
    case 'Shopping': return 'shopping';
    case 'Rent': return 'rent';
    case 'Entertainment': return 'entertainment';
    case 'Medical': return 'medical';
    case 'Family': return 'family';
    case 'EMI/Loan': return 'loan';
    case 'Subscription': return 'subscription';
    default: return 'other';
  }
};

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  months,
  selectedMonthId,
  monthlyIncomePaise,
  monthlyBudgetPaise,
  expenses,
  onSelectMonth,
  onOpenEditIncome,
  onOpenEditBudget,
  onAddExpenseClick,
}) => {
  // Calculations
  const totalSpendingPaise = useMemo(() => sumExpenses(expenses), [expenses]);

  // Persistent budget calculations using shared utility (MAS-03)
  const budgetMetrics = useMemo(
    () => calculateBudgetMetrics(monthlyBudgetPaise, totalSpendingPaise),
    [monthlyBudgetPaise, totalSpendingPaise]
  );
  const {
    hasBudget,
    remainingBudgetPaise,
    isOverBudget,
    visualProgress,
    usageLabel,
    statusPill,
  } = budgetMetrics;

  // Previous month data for MoM budget comparisons (Stage 12)
  const previousMonthId = useMemo(() => getPreviousMonthId(selectedMonthId), [selectedMonthId]);
  const prevSettings = useLiveQuery(
    () => financialSettingsRepository.getMonthlySettings(previousMonthId),
    [previousMonthId]
  );
  const prevExpenses = useLiveQuery(
    () => expenseRepository.getExpensesByMonth(previousMonthId),
    [previousMonthId]
  ) ?? [];

  const budgetComparison = useMemo(() => {
    return calculateMonthlyBudgetComparison(
      monthlyBudgetPaise,
      prevSettings?.budgetInPaise ?? null,
      expenses,
      prevExpenses
    );
  }, [monthlyBudgetPaise, prevSettings, expenses, prevExpenses]);

  // Net Cashflow
  const netCashflowPaise =
    monthlyIncomePaise !== null ? monthlyIncomePaise - totalSpendingPaise : null;
  const isNegativeCashflow = netCashflowPaise !== null && netCashflowPaise < 0;

  // Stage 12 Category Budget Analysis
  const categoryAnalysis = useMemo(() => {
    return analyzeCategoryBudgets(expenses, {});
  }, [expenses]);

  const currentMonthData = useMemo(() => {
    const found = months.find((m) => m.id === selectedMonthId);
    return found || { id: selectedMonthId, label: selectedMonthId, shortLabel: selectedMonthId };
  }, [months, selectedMonthId]);

  return (
    <div className="budgets-view-container">
      {/* Month Selector Bar */}
      <MonthSelector
        months={months}
        selectedMonthId={selectedMonthId}
        onSelectMonth={onSelectMonth}
      />

      {/* Main Budget Control Hero Card */}
      <section className="budget-hero-card">
        <div className="budget-hero-header">
          <div className="budget-hero-title-group">
            <span className="budget-hero-tag">Monthly Budget Control</span>
            <span className="budget-month-label">{currentMonthData.label}</span>
          </div>
          <button
            type="button"
            className="btn-edit-budget-action"
            onClick={onOpenEditBudget}
            aria-label="Edit Monthly Budget"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>{hasBudget ? 'Edit Limit' : 'Set Budget'}</span>
          </button>
        </div>

        {hasBudget ? (
          <div className="budget-hero-content">
            <div className="budget-hero-main-stat">
              <span className="budget-amount-label">Allocated Budget</span>
              <div className="budget-amount-val text-cyan">
                <span className="currency-symbol">₹</span>
                <span>{monthlyBudgetPaise !== null ? formatPaiseToRupees(monthlyBudgetPaise) : '0'}</span>
              </div>
            </div>

            <div className="budget-progress-block">
              <div className="budget-progress-labels">
                <span className="budget-progress-spent-text">
                  Spent: ₹{formatPaiseToRupees(totalSpendingPaise)}
                </span>
                <span className={`budget-usage-badge ${isOverBudget ? 'over-budget' : ''}`}>
                  {usageLabel}
                </span>
              </div>

              <div className="budget-progress-track">
                <div
                  className={`budget-progress-bar ${isOverBudget ? 'progress-alert' : ''}`}
                  style={{ width: `${visualProgress}%` }}
                />
              </div>
            </div>

            <div className="budget-hero-stats-row">
              <div className="budget-stat-col">
                <span className="stat-col-label">Remaining Balance</span>
                <span className={`stat-col-val ${isOverBudget ? 'text-rose' : 'text-emerald'}`}>
                  {remainingBudgetPaise !== null && remainingBudgetPaise < 0 ? '-₹' : '₹'}
                  {formatPaiseToRupees(Math.abs(remainingBudgetPaise ?? 0))}
                </span>
              </div>
              <div className="budget-stat-col">
                <span className="stat-col-label">Status</span>
                <span className={`stat-status-pill ${isOverBudget ? 'over-budget' : 'on-track'}`}>
                  {statusPill}
                </span>
              </div>
            </div>

            {/* Stage 12: Previous Month Comparison Context */}
            {budgetComparison.previousBudgetPaise !== null && (
              <div className="budget-mom-context-row" style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94a3b8' }}>
                <span>Previous Month Target: ₹{formatPaiseToRupees(budgetComparison.previousBudgetPaise)}</span>
                <span>
                  Budget {budgetComparison.budgetChangePaise && budgetComparison.budgetChangePaise >= 0 ? '+' : ''}
                  ₹{formatPaiseToRupees(budgetComparison.budgetChangePaise ?? 0)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="budget-hero-empty">
            <div className="empty-budget-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <p className="empty-budget-title">Budget not set</p>
            <p className="empty-budget-desc">Set a spending target for {currentMonthData.label} to visualize limits and track savings.</p>
            <button
              type="button"
              className="btn-set-budget-cta"
              onClick={onOpenEditBudget}
            >
              + Set Monthly Budget
            </button>
          </div>
        )}
      </section>

      {/* Income & Cashflow Overview Grid */}
      <section className="budget-summary-grid">
        {/* Income Card */}
        <div className="budget-summary-card">
          <div className="summary-card-top">
            <span className="summary-card-label">Monthly Income</span>
            <button
              type="button"
              className="btn-mini-edit"
              onClick={onOpenEditIncome}
              title="Edit income"
              aria-label="Edit Monthly Income"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
          {monthlyIncomePaise !== null ? (
            <div className="summary-card-amount text-emerald">
              <span className="currency-symbol-sm">₹</span>
              <span>{formatPaiseToRupees(monthlyIncomePaise)}</span>
            </div>
          ) : (
            <button
              type="button"
              className="btn-summary-setup"
              onClick={onOpenEditIncome}
            >
              + Set Income
            </button>
          )}
        </div>

        {/* Net Cashflow Card */}
        <div className="budget-summary-card">
          <div className="summary-card-top">
            <span className="summary-card-label">Net Cashflow</span>
            <span className="summary-card-badge">Income &minus; Spent</span>
          </div>
          {netCashflowPaise !== null ? (
            <div className={`summary-card-amount ${isNegativeCashflow ? 'text-rose' : 'text-emerald'}`}>
              <span className="currency-symbol-sm">{netCashflowPaise < 0 ? '-₹' : '₹'}</span>
              <span>{formatPaiseToRupees(Math.abs(netCashflowPaise))}</span>
            </div>
          ) : (
            <div className="summary-card-hint">
              <span>Set income to see cashflow</span>
            </div>
          )}
        </div>
      </section>

      {/* Category Spending Breakdown Section (Stage 12 Guardrails) */}
      <section className="budget-category-section">
        <div className="category-section-header">
          <h3 className="section-title">Category Spending Distribution</h3>
          <span className="category-count-badge">
            {categoryAnalysis.length} {categoryAnalysis.length === 1 ? 'category' : 'categories'}
          </span>
        </div>

        {categoryAnalysis.length === 0 ? (
          <div className="category-empty-card">
            <p className="category-empty-text">No expenses recorded for this month.</p>
            <button
              type="button"
              className="btn-empty-add-category"
              onClick={onAddExpenseClick}
            >
              + Add First Expense
            </button>
          </div>
        ) : (
          <div className="category-breakdown-list">
            {categoryAnalysis.map((item) => (
              <div key={item.category} className="category-progress-item">
                <div className="category-progress-header">
                  <div className="category-item-label">
                    <span className={`category-mini-dot ${getCategoryIconClass(item.category)}`} />
                    <span className="category-name" title={item.category}>{item.category}</span>
                  </div>
                  <div className="category-item-values">
                    <span className="category-amount">₹{formatPaiseToRupees(item.spentPaise)}</span>
                    <span className="category-percent">
                      {totalSpendingPaise > 0
                        ? `${Math.round((item.spentPaise / totalSpendingPaise) * 100)}%`
                        : '0%'}
                    </span>
                  </div>
                </div>
                <div className="category-bar-track">
                  <div
                    className={`category-bar-fill ${getCategoryIconClass(item.category)}`}
                    style={{
                      width: `${totalSpendingPaise > 0 ? Math.min(100, Math.max(2, (item.spentPaise / totalSpendingPaise) * 100)) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
