import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MonthData, Expense } from '../types';
import { MonthSelector } from './MonthSelector';
import { recurringPaymentRepository } from '../repositories/recurringPaymentRepository';
import { loanRepository } from '../repositories/loanRepository';
import { expenseRepository } from '../repositories/expenseRepository';
import { dashboardPreferencesRepository, DEFAULT_DASHBOARD_PREFERENCES } from '../repositories/dashboardPreferencesRepository';
import {
  formatPaiseToRupees,
  sumExpenses,
  calculateTodaySpending,
  getLocalTodayDateString,
  getDueDateStatus,
  formatDueDateFriendly,
  calculateCategorySpending,
  getPreviousMonthId,
  calculateMonthOverMonth,
  calculateIncomeVsExpense,
} from '../utils/finance';

export interface HomeViewProps {
  months: MonthData[];
  selectedMonthId: string;
  monthlyIncomePaise: number | null;
  monthlyBudgetPaise: number | null;
  expenses: Expense[];
  onSelectMonth: (monthId: string) => void;
  onOpenEditIncome: () => void;
  onOpenEditBudget: () => void;
  onAddExpenseClick: () => void;
  onViewAllExpensesClick: () => void;
  onEditExpense: (expense: Expense) => void;
  onOpenUpcoming: () => void;
  onOpenLoans: () => void;
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

const renderCategoryIcon = (cat: string): React.ReactNode => {
  switch (cat) {
    case 'Food':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />
        </svg>
      );
    case 'Travel':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="13" rx="2" />
          <circle cx="7" cy="19" r="2" />
          <circle cx="17" cy="19" r="2" />
          <line x1="7" y1="13" x2="17" y2="13" />
        </svg>
      );
    case 'Coffee & Snacks':
    case 'Coffee/Snacks':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
          <line x1="6" y1="2" x2="6" y2="4" />
          <line x1="10" y1="2" x2="10" y2="4" />
          <line x1="14" y1="2" x2="14" y2="4" />
        </svg>
      );
    case 'Bills':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'Shopping':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case 'Rent':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'Entertainment':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      );
    case 'Medical':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'Family':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'EMI/Loan':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case 'Subscription':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
};

export const HomeView: React.FC<HomeViewProps> = ({
  months,
  selectedMonthId,
  monthlyIncomePaise,
  monthlyBudgetPaise,
  expenses,
  onSelectMonth,
  onOpenEditIncome,
  onOpenEditBudget,
  onAddExpenseClick,
  onViewAllExpensesClick,
  onEditExpense,
  onOpenUpcoming,
  onOpenLoans,
}) => {
  // Live query for upcoming obligations from Dexie (Stage 7)
  const upcomingPayments = useLiveQuery(() => recurringPaymentRepository.getUpcomingPayments()) ?? [];
  const topUpcoming = upcomingPayments.slice(0, 3);

  // Live query for active loans from Dexie (Stage 8)
  const activeLoans = useLiveQuery(() => loanRepository.getActiveLoans()) ?? [];
  const totalLoanOutstandingPaise = activeLoans.reduce((sum, l) => sum + l.outstandingAmountInPaise, 0);
  const totalMonthlyLoanEmiPaise = activeLoans.reduce((sum, l) => sum + l.emiAmountInPaise, 0);

  // Previous month ID and live query for previous month expenses (Stage 9 MoM analytics)
  const previousMonthId = useMemo(() => getPreviousMonthId(selectedMonthId), [selectedMonthId]);
  const prevMonthExpenses = useLiveQuery(
    () => expenseRepository.getExpensesByMonth(previousMonthId),
    [previousMonthId]
  ) ?? [];

  const currentMonthData = useMemo(() => {
    return (
      months.find((m) => m.id === selectedMonthId) ||
      months[months.length - 1] || {
        id: selectedMonthId,
        label: selectedMonthId,
        shortLabel: selectedMonthId,
        isCurrentMonth: true,
      }
    );
  }, [months, selectedMonthId]);

  const prevMonthLabel = useMemo(() => {
    const found = months.find((m) => m.id === previousMonthId);
    if (found) return found.shortLabel;
    const [y, mStr] = previousMonthId.split('-');
    const mIdx = parseInt(mStr, 10) - 1;
    const shortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${shortNames[mIdx] || mStr} ${y}`;
  }, [months, previousMonthId]);

  // Real calculations from persisted expenses in IndexedDB (integer paise)
  const totalSpendingPaise = useMemo(() => sumExpenses(expenses), [expenses]);
  const prevTotalSpendingPaise = useMemo(() => sumExpenses(prevMonthExpenses), [prevMonthExpenses]);

  // Today's spending dynamically calculated from local calendar date (independent of selected month)
  const localTodayStr = getLocalTodayDateString();
  const todayExpenses = useLiveQuery(
    () => expenseRepository.getExpensesForToday(localTodayStr),
    [localTodayStr]
  ) ?? [];
  const todaySpendingPaise = useMemo(
    () => calculateTodaySpending(todayExpenses, localTodayStr),
    [todayExpenses, localTodayStr]
  );

  // Section visibility preferences from IndexedDB (defaults to ON)
  const dashboardPrefs = useLiveQuery(
    () => dashboardPreferencesRepository.getPreferences(),
    [],
    DEFAULT_DASHBOARD_PREFERENCES
  );
  const showUpcomingObligations = dashboardPrefs?.showUpcomingObligations ?? true;
  const showLoansSummary = dashboardPrefs?.showLoansSummary ?? true;

  // Stage 9: Month-over-Month Comparison
  const momResult = useMemo(
    () => calculateMonthOverMonth(totalSpendingPaise, prevTotalSpendingPaise),
    [totalSpendingPaise, prevTotalSpendingPaise]
  );

  // Stage 9: Income vs Expense Analytics (Net Savings & Savings Rate)
  const incomeVsExpense = useMemo(
    () => calculateIncomeVsExpense(monthlyIncomePaise, totalSpendingPaise),
    [monthlyIncomePaise, totalSpendingPaise]
  );

  // Stage 9: Category Spending Breakdown with Percentages
  const categorySpending = useMemo(
    () => calculateCategorySpending(expenses),
    [expenses]
  );

  // Stage 9: Recent expenses (most recent 5 expenses)
  const recentExpenses = useMemo(() => expenses.slice(0, 5), [expenses]);

  // Persistent budget calculations (integer paise)
  const hasBudget = monthlyBudgetPaise !== null;
  const isZeroBudget = monthlyBudgetPaise === 0;
  const remainingBudgetPaise = hasBudget ? monthlyBudgetPaise - totalSpendingPaise : null;
  const isOverBudget = remainingBudgetPaise !== null && remainingBudgetPaise < 0;

  // Budget usage percentage (never divide by zero)
  const budgetSpentPercent =
    hasBudget && monthlyBudgetPaise > 0
      ? Math.max(0, Math.round((totalSpendingPaise / monthlyBudgetPaise) * 1000) / 10)
      : null;

  return (
    <div className="home-view">
      {/* Month Selector Bar */}
      <MonthSelector
        months={months}
        selectedMonthId={selectedMonthId}
        onSelectMonth={onSelectMonth}
      />

      {/* Main Spending Highlights Section */}
      <section className="spending-hero-grid">
        {/* Total Monthly Spending Card */}
        <div className="summary-hero-card">
          <div className="summary-hero-top">
            <span className="summary-hero-label">
              Total Spending ({currentMonthData.shortLabel})
            </span>
            {hasBudget ? (
              <span className={`summary-hero-tag ${isOverBudget ? 'over-budget' : ''}`}>
                {isZeroBudget
                  ? (totalSpendingPaise > 0
                      ? `Over ₹0 limit by ₹${formatPaiseToRupees(totalSpendingPaise)}`
                      : '0% of budget')
                  : `${budgetSpentPercent?.toLocaleString('en-IN', { maximumFractionDigits: 1 })}% of budget`}
              </span>
            ) : (
              <span className="summary-hero-tag muted">Budget not set</span>
            )}
          </div>

          <div className="summary-hero-amount">
            <span className="currency-symbol">₹</span>
            <span className="amount-number">{formatPaiseToRupees(totalSpendingPaise)}</span>
          </div>

          {hasBudget ? (
            <div className="summary-progress-bar">
              <div
                className={`summary-progress-fill ${isOverBudget ? 'progress-alert' : ''}`}
                style={{
                  width: `${isZeroBudget ? (totalSpendingPaise > 0 ? 100 : 0) : Math.min(100, budgetSpentPercent ?? 0)}%`,
                }}
              />
            </div>
          ) : (
            <p className="summary-hero-hint">Configure a monthly budget below to visualize spending limits.</p>
          )}
        </div>

        {/* Dual Highlights: Today's Spending + MoM Comparison */}
        <div className="spending-sub-grid">
          {/* Today's Spending Card */}
          <div className="today-spending-card">
            <div className="today-header">
              <div className="today-icon-wrapper" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="today-title-group">
                <span className="today-label">Today's Spending</span>
                <span className="today-sub">
                  Recorded today
                </span>
              </div>
            </div>
            <div className="today-amount">
              <span className="currency-symbol-sm">₹</span>
              <span>{formatPaiseToRupees(todaySpendingPaise)}</span>
            </div>
          </div>

          {/* Month-over-Month Comparison Card */}
          <div className="mom-comparison-card">
            <div className="mom-header">
              <span className="mom-label">vs {prevMonthLabel}</span>
              {momResult.percentChange !== null ? (
                <span className={`mom-badge ${momResult.diffPaise === 0 ? 'neutral' : momResult.isIncrease ? 'higher' : 'lower'}`}>
                  {momResult.diffPaise === 0
                    ? '0%'
                    : `${momResult.isIncrease ? '+' : '-'}${momResult.percentChange}%`}
                </span>
              ) : (
                <span className="mom-badge neutral">
                  {prevTotalSpendingPaise === 0 && totalSpendingPaise > 0 ? 'New' : '0%'}
                </span>
              )}
            </div>
            <div className="mom-stat-body">
              <span className="mom-diff-amount">
                {momResult.diffPaise === 0
                  ? '₹0'
                  : `${momResult.diffPaise > 0 ? '+₹' : '-₹'}${formatPaiseToRupees(Math.abs(momResult.diffPaise))}`}
              </span>
              <span className="mom-context">
                {prevTotalSpendingPaise === 0 && totalSpendingPaise > 0
                  ? 'First month of spending'
                  : prevTotalSpendingPaise === 0 && totalSpendingPaise === 0
                  ? 'No expenses in both months'
                  : momResult.isIncrease
                  ? 'More than last month'
                  : 'Saved compared to last month'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Financial Setup & Planning Section (Income, Budget & Net Cashflow) */}
      <section className="financial-planning-section">
        <div className="planning-header">
          <span className="planning-title">Financial Setup & Analytics</span>
          <span className="planning-badge">Monthly</span>
        </div>

        <div className="planning-cards-grid">
          {/* Monthly Income Card */}
          <div className="planning-card">
            <div className="planning-card-top">
              <span className="planning-label">Monthly Income</span>
              <button
                type="button"
                className="btn-edit-icon"
                onClick={onOpenEditIncome}
                aria-label="Edit Monthly Income"
                title="Edit Income"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>

            {monthlyIncomePaise !== null ? (
              <div className="planning-value text-emerald">
                <span className="currency-symbol-sm">₹</span>
                <span>{formatPaiseToRupees(monthlyIncomePaise)}</span>
              </div>
            ) : (
              <button
                type="button"
                className="btn-setup-action"
                onClick={onOpenEditIncome}
              >
                + Set your monthly income
              </button>
            )}
          </div>

          {/* Monthly Budget Card */}
          <div className="planning-card">
            <div className="planning-card-top">
              <span className="planning-label">Monthly Budget</span>
              <button
                type="button"
                className="btn-edit-icon"
                onClick={onOpenEditBudget}
                aria-label="Edit Monthly Budget"
                title="Edit Budget"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>

            {monthlyBudgetPaise !== null ? (
              <div className="planning-value text-cyan">
                <span className="currency-symbol-sm">₹</span>
                <span>{formatPaiseToRupees(monthlyBudgetPaise)}</span>
              </div>
            ) : (
              <button
                type="button"
                className="btn-setup-action"
                onClick={onOpenEditBudget}
              >
                + Set your monthly budget
              </button>
            )}
          </div>

          {/* Remaining Budget Card */}
          <div className="planning-card remaining-card">
            <div className="planning-card-top">
              <span className="planning-label">Remaining Budget</span>
              <span className="calc-tag">Auto-Calculated</span>
            </div>

            {remainingBudgetPaise !== null ? (
              <div className={`planning-value ${isOverBudget ? 'text-rose' : 'text-primary'}`}>
                <span className="currency-symbol-sm">{remainingBudgetPaise < 0 ? '-₹' : '₹'}</span>
                <span>{formatPaiseToRupees(Math.abs(remainingBudgetPaise))}</span>
                {isOverBudget && (
                  <span className="over-budget-pill">
                    {isZeroBudget ? 'Over ₹0 Limit' : 'Over Limit'}
                  </span>
                )}
              </div>
            ) : (
              <div className="empty-budget-notice">
                <span>Set budget above to see remaining balance</span>
              </div>
            )}
          </div>

          {/* Income vs Expense (Net Cashflow / Savings) */}
          <div className="planning-card cashflow-card">
            <div className="planning-card-top">
              <span className="planning-label">Net Savings (Cashflow)</span>
              {incomeVsExpense.savingsRatePercent !== null && !incomeVsExpense.isDeficit && (
                <span className="savings-rate-tag">{incomeVsExpense.savingsRatePercent}% saved</span>
              )}
            </div>

            {incomeVsExpense.netPaise !== null ? (
              <div className={`planning-value ${incomeVsExpense.isDeficit ? 'text-rose' : 'text-emerald'}`}>
                <span className="currency-symbol-sm">{incomeVsExpense.netPaise < 0 ? '-₹' : '₹'}</span>
                <span>{formatPaiseToRupees(Math.abs(incomeVsExpense.netPaise))}</span>
                {incomeVsExpense.isDeficit && <span className="over-budget-pill">Deficit</span>}
              </div>
            ) : (
              <div className="empty-budget-notice">
                <span>Set income above to track monthly net savings</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Highly Visible Add Expense Action */}
      <section className="quick-action-section">
        <button
          type="button"
          className="btn-primary-add"
          onClick={onAddExpenseClick}
          aria-label="Add New Expense"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Expense</span>
        </button>
      </section>

      {/* Stage 9: Spending by Category Breakdown (Visualization) */}
      <section className="category-spending-section">
        <div className="section-header">
          <div className="section-title-wrapper">
            <h3 className="section-title">Spending by Category</h3>
          </div>
          {categorySpending.length > 0 && (
            <span className="section-subtext">
              {categorySpending.length} {categorySpending.length === 1 ? 'category' : 'categories'}
            </span>
          )}
        </div>

        {categorySpending.length === 0 ? (
          <div className="category-empty-card">
            <p className="category-empty-text">No expenses recorded for this month.</p>
          </div>
        ) : (
          <div className="category-breakdown-list">
            {categorySpending.map((item) => (
              <div key={item.category} className="category-progress-item">
                <div className="category-progress-header">
                  <div className="category-item-label">
                    <span className={`category-mini-dot ${getCategoryIconClass(item.category)}`} />
                    <span className="category-name" title={item.category}>{item.category}</span>
                  </div>
                  <div className="category-item-values">
                    <span className="category-amount">₹{formatPaiseToRupees(item.totalPaise)}</span>
                    <span className="category-percent">{item.percentage}%</span>
                  </div>
                </div>
                <div className="category-bar-track">
                  <div
                    className={`category-bar-fill ${getCategoryIconClass(item.category)}`}
                    style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lightweight Upcoming Payments Dashboard Section (Stage 7) */}
      {showUpcomingObligations && (
        <section className="upcoming-summary-section">
          <div className="section-header">
            <div className="section-title-wrapper">
              <h3 className="section-title">Upcoming Obligations</h3>
            </div>
            <button
              type="button"
              className="btn-text-link"
              onClick={onOpenUpcoming}
            >
              {upcomingPayments.length > 0 ? `View all (${upcomingPayments.length})` : 'Manage'}
            </button>
          </div>

          {upcomingPayments.length === 0 ? (
            <div className="upcoming-home-empty">
              <p>No upcoming payments</p>
              <button
                type="button"
                className="btn-mini-add-upcoming"
                onClick={onOpenUpcoming}
              >
                + Add Obligation
              </button>
            </div>
          ) : (
            <div className="upcoming-home-list">
              {topUpcoming.map((item) => {
                const status = getDueDateStatus(item.nextDueDate, localTodayStr);
                return (
                  <div
                    key={item.id}
                    className={`upcoming-home-item ${status}`}
                    onClick={onOpenUpcoming}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="upcoming-home-left">
                      <span className={`upcoming-home-badge ${status}`}>
                        {formatDueDateFriendly(item.nextDueDate, localTodayStr)}
                      </span>
                      <div className="upcoming-home-text">
                        <span className="upcoming-home-name" title={item.name}>{item.name}</span>
                        <span className="upcoming-home-cat" title={`${item.category} • ${item.frequency}`}>{item.category} &bull; {item.frequency}</span>
                      </div>
                    </div>

                    <div className="upcoming-home-right">
                      <span className="upcoming-home-amount">
                        ₹{formatPaiseToRupees(item.amountInPaise)}
                      </span>
                      <button
                        type="button"
                        className="btn-mini-paid"
                        onClick={(e) => {
                          e.stopPropagation();
                          recurringPaymentRepository.markAsPaid(item.id);
                        }}
                        title="Mark as paid"
                        aria-label={`Mark ${item.name} as paid`}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Lightweight Loan & EMI Summary Section (Stage 8) */}
      {showLoansSummary && (
        <section className="loans-summary-section">
          <div className="section-header">
            <div className="section-title-wrapper">
              <h3 className="section-title">Loans & EMI Summary</h3>
            </div>
            <button
              type="button"
              className="btn-text-link"
              onClick={onOpenLoans}
            >
              {activeLoans.length > 0 ? `Manage (${activeLoans.length})` : 'Manage'}
            </button>
          </div>

          {activeLoans.length === 0 ? (
            <div className="loans-home-empty">
              <p>No active loans</p>
              <button
                type="button"
                className="btn-mini-add-loan"
                onClick={onOpenLoans}
              >
                + Add Loan / EMI
              </button>
            </div>
          ) : (
            <div
              className="loans-home-card"
              onClick={onOpenLoans}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenLoans();
                }
              }}
              aria-label={`View active loans: Total outstanding ₹${formatPaiseToRupees(totalLoanOutstandingPaise)}, Monthly EMI ₹${formatPaiseToRupees(totalMonthlyLoanEmiPaise)}`}
            >
              <div className="loans-home-stat">
                <span className="loans-home-stat-label">Outstanding</span>
                <span className="loans-home-stat-val text-rose">
                  ₹{formatPaiseToRupees(totalLoanOutstandingPaise)}
                </span>
              </div>
              <div className="loans-home-divider" />
              <div className="loans-home-stat">
                <span className="loans-home-stat-label">Monthly EMI</span>
                <span className="loans-home-stat-val text-cyan">
                  ₹{formatPaiseToRupees(totalMonthlyLoanEmiPaise)}
                </span>
              </div>
              <div className="loans-home-divider" />
              <div className="loans-home-stat">
                <span className="loans-home-stat-label">Active Loans</span>
                <span className="loans-home-stat-val">{activeLoans.length}</span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Recent Expenses List (Stage 9 Section 11) */}
      <section className="recent-expenses-section">
        <div className="section-header">
          <div className="section-title-wrapper">
            <h3 className="section-title">Recent Expenses</h3>
          </div>
          {expenses.length > 0 && (
            <button
              type="button"
              className="btn-text-link"
              onClick={onViewAllExpensesClick}
            >
              View all ({expenses.length})
            </button>
          )}
        </div>

        <div className="expense-list">
          {expenses.length === 0 ? (
            <div className="empty-expenses-box">
              <div className="empty-expenses-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <p className="empty-expenses-title">No expenses recorded yet.</p>
              <button
                type="button"
                className="btn-empty-add"
                onClick={onAddExpenseClick}
              >
                + Add Expense
              </button>
            </div>
          ) : (
            recentExpenses.map((item) => (
              <article
                key={item.id}
                className="expense-item-row"
                role="button"
                tabIndex={0}
                onClick={() => onEditExpense(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onEditExpense(item);
                  }
                }}
                aria-label={`Edit ${item.category} expense: -₹${formatPaiseToRupees(item.amountInPaise)}, ${item.date}`}
              >
                <div className={`expense-icon-box ${getCategoryIconClass(item.category)}`}>
                  {renderCategoryIcon(item.category)}
                </div>

                <div className="expense-details">
                  <div className="expense-primary-info">
                    <span className="expense-category" title={item.category}>{item.category}</span>
                    <span className="expense-amount">
                      -₹{formatPaiseToRupees(item.amountInPaise)}
                    </span>
                  </div>
                  <div className="expense-secondary-info">
                    <span className="expense-meta" title={`${item.date} • ${item.paymentMethod}`}>
                      {item.date} • {item.paymentMethod}
                    </span>
                    {item.note && <span className="expense-note" title={item.note}>{item.note}</span>}
                  </div>
                </div>

                <div className="expense-action-hint" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
