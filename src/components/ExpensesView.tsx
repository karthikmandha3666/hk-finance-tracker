import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Expense, MonthData } from '../types';
import { MonthSelector } from './MonthSelector';
import { expenseRepository } from '../repositories/expenseRepository';
import { categoryRepository, sortCategoryNamesDeterministic } from '../repositories/categoryRepository';
import { paymentMethodRepository } from '../repositories/paymentMethodRepository';
import { formatPaiseToRupees, sumExpenses } from '../utils/finance';
import { exportExpensesToCsv, downloadCsvFile } from '../utils/csv';

export interface ExpensesViewProps {
  months: MonthData[];
  selectedMonthId: string;
  onSelectMonth: (monthId: string) => void;
  expenses: Expense[];
  onAddExpenseClick: () => void;
  onEditExpense: (expense: Expense) => void;
}

export type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

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
    default:
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
};

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  months,
  selectedMonthId,
  onSelectMonth,
  expenses,
  onAddExpenseClick,
  onEditExpense,
}) => {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');

  // Multi-Selection State (Stage 13)
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Deletion state with concurrency protection (Step 1 & Step 4)
  const [expensePendingDelete, setExpensePendingDelete] = useState<Expense | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isDeletingRef = useRef<boolean>(false);

  // Reset filters and selection when navigating across months (MAS-12)
  const prevMonthRef = useRef(selectedMonthId);
  useEffect(() => {
    if (prevMonthRef.current !== selectedMonthId) {
      prevMonthRef.current = selectedMonthId;
      setSelectedCategoryFilter('');
      setSelectedMethodFilter('');
      setSearchQuery('');
      setIsSelectionMode(false);
      setSelectedIds(new Set());
    }
  }, [selectedMonthId]);

  // Available categories & payment methods from IndexedDB configuration
  const activeCategories = useLiveQuery(() => categoryRepository.getActiveCategories()) ?? [];
  const activeMethods = useLiveQuery(() => paymentMethodRepository.getActivePaymentMethods()) ?? [];

  // Extract unique categories & payment methods present in the current month's expenses
  const availableCategories = useMemo(() => {
    const fromExpenses = Array.from(new Set(expenses.map((e) => e.category))).filter(Boolean);
    const fromConfig = activeCategories.map((c) => c.name);
    return sortCategoryNamesDeterministic(Array.from(new Set([...fromExpenses, ...fromConfig])));
  }, [expenses, activeCategories]);

  const availableMethods = useMemo(() => {
    const fromExpenses = Array.from(new Set(expenses.map((e) => e.paymentMethod))).filter(Boolean);
    const fromConfig = activeMethods.map((m) => m.name);
    return Array.from(new Set([...fromExpenses, ...fromConfig])).sort();
  }, [expenses, activeMethods]);

  // Filtering: combines Category, Payment Method, and Free-text Search
  const filteredExpenses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return expenses.filter((item) => {
      // Category filter
      if (selectedCategoryFilter && item.category !== selectedCategoryFilter) {
        return false;
      }
      // Payment method filter
      if (selectedMethodFilter && item.paymentMethod !== selectedMethodFilter) {
        return false;
      }
      // Search query filter (matches category, note, payment method, or rupee amount)
      if (query) {
        const catMatch = (item.category || '').toLowerCase().includes(query);
        const noteMatch = (item.note || '').toLowerCase().includes(query);
        const methodMatch = (item.paymentMethod || '').toLowerCase().includes(query);
        const amountStr = formatPaiseToRupees(item.amountInPaise).replace(/,/g, '');
        const amountMatch = amountStr.includes(query);
        if (!catMatch && !noteMatch && !methodMatch && !amountMatch) {
          return false;
        }
      }
      return true;
    });
  }, [expenses, selectedCategoryFilter, selectedMethodFilter, searchQuery]);

  // Sorting: newest, oldest, highest amount, lowest amount
  const sortedExpenses = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => {
      switch (sortOption) {
        case 'date-asc': {
          if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
          return (a.createdAt || '').localeCompare(b.createdAt || '');
        }
        case 'amount-desc': {
          return b.amountInPaise - a.amountInPaise;
        }
        case 'amount-asc': {
          return a.amountInPaise - b.amountInPaise;
        }
        case 'date-desc':
        default: {
          if (a.date !== b.date) return (b.date || '').localeCompare(a.date || '');
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        }
      }
    });
  }, [filteredExpenses, sortOption]);

  // Metrics
  const totalMonthSpendingPaise = useMemo(() => sumExpenses(expenses), [expenses]);
  const totalFilteredSpendingPaise = useMemo(() => sumExpenses(filteredExpenses), [filteredExpenses]);

  // Selected totals for bulk actions
  const selectedExpenses = useMemo(() => {
    return sortedExpenses.filter((e) => selectedIds.has(e.id));
  }, [sortedExpenses, selectedIds]);
  const selectedSpendingPaise = useMemo(() => sumExpenses(selectedExpenses), [selectedExpenses]);

  const currentMonthData = useMemo(() => {
    const found = months.find((m) => m.id === selectedMonthId);
    return found || { id: selectedMonthId, label: selectedMonthId, shortLabel: selectedMonthId };
  }, [months, selectedMonthId]);

  // Multi-Selection Handlers (Stage 13)
  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setIsSelectionMode(false);
      setSelectedIds(new Set());
    } else {
      setIsSelectionMode(true);
    }
  };

  const toggleSelectExpense = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === sortedExpenses.length && sortedExpenses.length > 0) {
      // Unselect all
      setSelectedIds(new Set());
    } else {
      // Select all currently visible filtered records
      setSelectedIds(new Set(sortedExpenses.map((e) => e.id)));
    }
  };

  // Single Deletion Handlers with Concurrency Guard (Step 1)
  const handleRequestDelete = (e: React.MouseEvent, item: Expense) => {
    e.stopPropagation();
    if (isDeleting) return;
    setDeleteError(null);
    setExpensePendingDelete(item);
  };

  const handleConfirmDelete = async () => {
    if (!expensePendingDelete || isDeletingRef.current || isDeleting) return;
    isDeletingRef.current = true;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await expenseRepository.deleteExpense(expensePendingDelete.id);
      setExpensePendingDelete(null);
      // Remove from selection set if present
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(expensePendingDelete.id);
        return next;
      });
    } catch (err) {
      console.error('Failed to delete expense:', err);
      try {
        const stillExists = await expenseRepository.getExpenseById(expensePendingDelete.id);
        if (!stillExists) {
          // Already deleted by a concurrent operation; dismiss modal cleanly!
          setExpensePendingDelete(null);
          return;
        }
      } catch {
        // Ignore check error
      }
      setDeleteError('Unable to delete expense. Please try again.');
    } finally {
      isDeletingRef.current = false;
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (!isDeleting) {
      setExpensePendingDelete(null);
      setDeleteError(null);
    }
  };

  // Bulk Deletion Handlers (Stage 13)
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.size === 0 || isDeletingRef.current || isDeleting) return;
    isDeletingRef.current = true;
    setIsDeleting(true);
    setDeleteError(null);

    const idsToDelete = Array.from(selectedIds);
    try {
      await expenseRepository.deleteExpenses(idsToDelete);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      setShowBulkDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to bulk delete expenses:', err);
      setDeleteError('Failed to delete selected expenses. Please try again.');
    } finally {
      isDeletingRef.current = false;
      setIsDeleting(false);
    }
  };

  const hasActiveFilters = Boolean(
    selectedCategoryFilter || selectedMethodFilter || searchQuery.trim()
  );

  const clearAllFilters = () => {
    setSelectedCategoryFilter('');
    setSelectedMethodFilter('');
    setSearchQuery('');
  };

  const handleExportMonthCsv = () => {
    if (expenses.length === 0) return;
    const csvContent = exportExpensesToCsv(expenses);
    downloadCsvFile(csvContent, `spendly-expenses-${selectedMonthId}.csv`);
  };

  return (
    <div className="expenses-view-container">
      {/* Month Selector Bar */}
      <MonthSelector
        months={months}
        selectedMonthId={selectedMonthId}
        onSelectMonth={onSelectMonth}
      />

      {/* Transaction Workspace Header */}
      <section className="expenses-hero-card">
        <div className="expenses-hero-top">
          <div className="expenses-hero-text">
            <span className="expenses-hero-sublabel">Total Spent ({currentMonthData.shortLabel})</span>
            <div className="expenses-hero-amount">
              <span className="currency-symbol">₹</span>
              <span>{formatPaiseToRupees(totalMonthSpendingPaise)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn-expenses-select-mode ${isSelectionMode ? 'active' : ''}`}
              onClick={toggleSelectionMode}
              aria-pressed={isSelectionMode}
            >
              {isSelectionMode ? 'Done' : 'Select'}
            </button>
            <button
              type="button"
              className="btn-expenses-export-month"
              onClick={handleExportMonthCsv}
              disabled={expenses.length === 0}
              title={`Export ${currentMonthData.shortLabel} expenses to CSV`}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="expenses-hero-bottom">
          <span className="expenses-hero-count">
            {expenses.length} {expenses.length === 1 ? 'transaction' : 'transactions'}
          </span>
          {hasActiveFilters && (
            <span className="expenses-hero-filtered-stat">
              Filtered: ₹{formatPaiseToRupees(totalFilteredSpendingPaise)} ({filteredExpenses.length})
            </span>
          )}
        </div>
      </section>

      {/* Bulk Selection Bar (Stage 13) */}
      {isSelectionMode && (
        <div className="bulk-selection-bar" role="toolbar" aria-label="Bulk actions toolbar">
          <div className="bulk-selection-left">
            <button
              type="button"
              className="btn-bulk-select-all"
              onClick={handleSelectAll}
            >
              {selectedIds.size === sortedExpenses.length && sortedExpenses.length > 0
                ? 'Deselect All'
                : `Select All (${sortedExpenses.length})`}
            </button>
            <span className="bulk-selected-count">
              <strong>{selectedIds.size}</strong> selected (₹{formatPaiseToRupees(selectedSpendingPaise)})
            </span>
          </div>

          <button
            type="button"
            className="btn-bulk-delete"
            disabled={selectedIds.size === 0 || isDeleting}
            onClick={() => {
              setDeleteError(null);
              setShowBulkDeleteConfirm(true);
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Delete Selected ({selectedIds.size})</span>
          </button>
        </div>
      )}

      {/* Search & Filter Control Bar (Stage 13) */}
      <div className="expenses-filter-bar">
        {/* Free-text search input */}
        <div className="expenses-search-group">
          <div className="expenses-search-wrapper">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="expenses-search-input"
              placeholder="Search notes, categories, payment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search transactions"
            />
            {searchQuery && (
              <button
                type="button"
                className="btn-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search input"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Filter dropdowns row */}
        <div className="expenses-filters-row">
          <div className="filter-group">
            <label htmlFor="filter-category-select" className="filter-label">Category</label>
            <select
              id="filter-category-select"
              className="filter-select"
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              aria-label="Filter expenses by category"
            >
              <option value="">All Categories ({availableCategories.length})</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-method-select" className="filter-label">Payment</label>
            <select
              id="filter-method-select"
              className="filter-select"
              value={selectedMethodFilter}
              onChange={(e) => setSelectedMethodFilter(e.target.value)}
              aria-label="Filter expenses by payment method"
            >
              <option value="">All Methods ({availableMethods.length})</option>
              {availableMethods.map((pm) => (
                <option key={pm} value={pm}>{pm}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-sort-select" className="filter-label">Sort</label>
            <select
              id="filter-sort-select"
              className="filter-select"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              aria-label="Sort transactions"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Filter Visibility & Clearing Banner (DEF-04) */}
      {hasActiveFilters && (
        <div className="active-filters-banner" role="status" aria-live="polite">
          <div className="active-filters-info">
            <span className="active-filters-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </span>
            <div className="active-filters-text">
              <span className="active-filters-count-text">
                Showing <strong>{filteredExpenses.length}</strong> of <strong>{expenses.length}</strong> transactions
              </span>
              <div className="active-filter-chips">
                {searchQuery && (
                  <span className="active-filter-tag">Search: &quot;{searchQuery}&quot;</span>
                )}
                {selectedCategoryFilter && (
                  <span className="active-filter-tag">Category: {selectedCategoryFilter}</span>
                )}
                {selectedMethodFilter && (
                  <span className="active-filter-tag">Payment: {selectedMethodFilter}</span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-clear-filters-banner"
            onClick={clearAllFilters}
            aria-label="Clear all active filters"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Expense List Section */}
      <section className="expenses-ledger-section">
        <div className="ledger-header">
          <h3 className="ledger-title">Transactions</h3>
          <span className="ledger-count-badge">
            {filteredExpenses.length} of {expenses.length}
          </span>
        </div>

        {expenses.length === 0 ? (
          <div className="empty-expenses-box">
            <div className="empty-expenses-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <p className="empty-expenses-title">No expenses recorded for {currentMonthData.label}</p>
            <p className="empty-expenses-subtitle">Start tracking your daily expenses by adding one now.</p>
            <button
              type="button"
              className="btn-empty-add"
              onClick={onAddExpenseClick}
            >
              + Add Expense
            </button>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="empty-expenses-box">
            <p className="empty-expenses-title">No expenses match the selected filters</p>
            <p className="empty-expenses-subtitle">Try clearing your search query or changing filters.</p>
            <button
              type="button"
              className="btn-empty-add"
              onClick={clearAllFilters}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="expenses-ledger-list">
            {sortedExpenses.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <article
                  key={item.id}
                  className={`expense-ledger-item ${isSelected ? 'selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (isDeleting) return;
                    if (isSelectionMode) {
                      toggleSelectExpense({ stopPropagation: () => {} } as React.MouseEvent, item.id);
                    } else {
                      onEditExpense(item);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (isSelectionMode) {
                        toggleSelectExpense({ stopPropagation: () => {} } as React.MouseEvent, item.id);
                      } else {
                        onEditExpense(item);
                      }
                    }
                  }}
                  aria-label={`Edit ${item.category} expense: ₹${formatPaiseToRupees(item.amountInPaise)}, ${item.date}`}
                >
                  {/* Selection Mode Checkbox (Stage 13) */}
                  {isSelectionMode && (
                    <div
                      className="expense-select-checkbox-container"
                      onClick={(e) => toggleSelectExpense(e, item.id)}
                    >
                      <input
                        type="checkbox"
                        className="expense-row-checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Controlled by container click
                        aria-label={`Select ${item.category} transaction`}
                      />
                    </div>
                  )}

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
                        {item.date} &bull; {item.paymentMethod}
                      </span>
                      {item.note && <span className="expense-note" title={item.note}>{item.note}</span>}
                    </div>
                  </div>

                  {!isSelectionMode && (
                    <div className="expense-ledger-actions">
                      <button
                        type="button"
                        className="btn-ledger-action edit"
                        disabled={isDeleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isDeleting) onEditExpense(item);
                        }}
                        title="Edit transaction"
                        aria-label={`Edit ${item.category} transaction`}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="btn-ledger-action delete"
                        disabled={isDeleting}
                        onClick={(e) => handleRequestDelete(e, item)}
                        title="Delete transaction"
                        aria-label={`Delete ${item.category} transaction`}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Single Delete Confirmation Modal */}
      {expensePendingDelete && (
        <div
          className="modal-backdrop"
          onClick={handleCancelDelete}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-ledger-modal-title"
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 id="delete-ledger-modal-title" className="modal-title">Delete Expense?</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCancelDelete}
                aria-label="Close dialog"
                disabled={isDeleting}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="modal-desc">
              Are you sure you want to delete this expense of{' '}
              <strong style={{ color: '#f8fafc' }}>
                ₹{formatPaiseToRupees(expensePendingDelete.amountInPaise)}
              </strong>{' '}
              ({expensePendingDelete.category}) on {expensePendingDelete.date}? This action cannot be undone.
            </p>

            {deleteError && (
              <p className="modal-error-text" role="alert">
                {deleteError}
              </p>
            )}

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-delete"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal (Stage 13) */}
      {showBulkDeleteConfirm && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!isDeleting) setShowBulkDeleteConfirm(false);
          }}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-delete-modal-title"
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 id="bulk-delete-modal-title" className="modal-title">
                  Delete {selectedIds.size} Transactions?
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => {
                  if (!isDeleting) setShowBulkDeleteConfirm(false);
                }}
                aria-label="Close dialog"
                disabled={isDeleting}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="modal-desc">
              Are you sure you want to permanently delete{' '}
              <strong style={{ color: '#f8fafc' }}>{selectedIds.size} selected transactions</strong>{' '}
              totaling{' '}
              <strong style={{ color: '#f8fafc' }}>₹{formatPaiseToRupees(selectedSpendingPaise)}</strong>?
              This action cannot be undone.
            </p>

            {deleteError && (
              <p className="modal-error-text" role="alert">
                {deleteError}
              </p>
            )}

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-delete"
                onClick={handleConfirmBulkDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : `Yes, Delete ${selectedIds.size} Records`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
