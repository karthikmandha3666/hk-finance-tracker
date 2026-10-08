import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MonthData, Expense } from '../types';
import { MonthSelector } from './MonthSelector';
import { recurringPaymentRepository } from '../repositories/recurringPaymentRepository';
import {
  formatPaiseToRupees,
  sumExpenses,
  calculateTodaySpending,
  getLocalTodayDateString,
  getDueDateStatus,
  formatDueDateFriendly,
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
}) => {
  // Live query for upcoming obligations from Dexie
  const upcomingPayments = useLiveQuery(() => recurringPaymentRepository.getUpcomingPayments()) ?? [];
  const topUpcoming = upcomingPayments.slice(0, 3);

  const currentMonthData =
    months.find((m) => m.id === selectedMonthId) ||
    months[months.length - 1] || {
      id: selectedMonthId,
      label: selectedMonthId,
      shortLabel: selectedMonthId,
      isCurrentMonth: true,
    };

  // Real calculations from persisted expenses in IndexedDB (integer paise)
  const totalSpendingPaise = sumExpenses(expenses);

  // Today's spending dynamically calculated from local calendar date (no UTC conversion, no isToday field)
  const localTodayStr = getLocalTodayDateString();
  const todaySpendingPaise = calculateTodaySpending(expenses, localTodayStr);

  // Persistent budget calculations (integer paise)
  const hasBudget = monthlyBudgetPaise !== null && monthlyBudgetPaise > 0;
  const remainingBudgetPaise =
    hasBudget ? monthlyBudgetPaise - totalSpendingPaise : null;
  const isOverBudget = remainingBudgetPaise !== null && remainingBudgetPaise < 0;

  // Percentage spent
  const budgetSpentPercent =
    hasBudget && monthlyBudgetPaise > 0
      ? Math.min(100, Math.round((totalSpendingPaise / monthlyBudgetPaise) * 100))
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
                {budgetSpentPercent}% of budget
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
                style={{ width: `${budgetSpentPercent}%` }}
              />
            </div>
          ) : (
            <p className="summary-hero-hint">Configure a monthly budget below to visualize spending limits.</p>
          )}
        </div>

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
                {currentMonthData.isCurrentMonth ? 'Recorded today' : 'Prior month'}
              </span>
            </div>
          </div>
          <div className="today-amount">
            <span className="currency-symbol-sm">₹</span>
            <span>{formatPaiseToRupees(todaySpendingPaise)}</span>
          </div>
        </div>
      </section>

      {/* Financial Setup & Planning Section (Persistent Income & Budget) */}
      <section className="financial-planning-section">
        <div className="planning-header">
          <span className="planning-title">Financial Setup</span>
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
                + Set Monthly Income
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
                + Set Spending Budget
              </button>
            )}
          </div>

          {/* Remaining Budget Card (Calculated from Real Expenses) */}
          <div className="planning-card remaining-card">
            <div className="planning-card-top">
              <span className="planning-label">Remaining Budget</span>
              <span className="calc-tag">Auto-Calculated</span>
            </div>

            {remainingBudgetPaise !== null ? (
              <div className={`planning-value ${isOverBudget ? 'text-rose' : 'text-primary'}`}>
                <span className="currency-symbol-sm">{remainingBudgetPaise < 0 ? '-₹' : '₹'}</span>
                <span>{formatPaiseToRupees(Math.abs(remainingBudgetPaise))}</span>
                {isOverBudget && <span className="over-budget-pill">Over Limit</span>}
              </div>
            ) : (
              <div className="empty-budget-notice">
                <span>Set budget above to see remaining balance</span>
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

      {/* Lightweight Upcoming Payments Dashboard Section (Stage 7) */}
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
            <p>No upcoming bills or recurring payments.</p>
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
                      <span className="upcoming-home-name">{item.name}</span>
                      <span className="upcoming-home-cat">{item.category} &bull; {item.frequency}</span>
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

      {/* Selected Month Expenses List (Real Local-First Dexie Storage) */}
      <section className="recent-expenses-section">
        <div className="section-header">
          <div className="section-title-wrapper">
            <h3 className="section-title">{currentMonthData.label} Expenses</h3>
          </div>
          {expenses.length > 0 && (
            <button
              type="button"
              className="btn-text-link"
              onClick={onViewAllExpensesClick}
            >
              View all
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
              <p className="empty-expenses-title">No expenses recorded for this month.</p>
              <button
                type="button"
                className="btn-empty-add"
                onClick={onAddExpenseClick}
              >
                + Add Expense
              </button>
            </div>
          ) : (
            expenses.map((item) => (
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
                    <span className="expense-category">{item.category}</span>
                    <span className="expense-amount">
                      -₹{formatPaiseToRupees(item.amountInPaise)}
                    </span>
                  </div>
                  <div className="expense-secondary-info">
                    <span className="expense-meta">
                      {item.date} • {item.paymentMethod}
                    </span>
                    {item.note && <span className="expense-note">{item.note}</span>}
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
