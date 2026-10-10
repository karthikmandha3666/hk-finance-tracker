import { Expense } from '../types';
import { sumExpenses } from './finance';

export type BudgetStatusLevel =
  | 'within-budget'
  | 'approaching-limit'
  | 'budget-reached'
  | 'over-budget'
  | 'no-budget';

export interface CategoryBudgetAnalysis {
  category: string;
  spentPaise: number;
  allocatedPaise: number | null;
  remainingPaise: number | null;
  exceededPaise: number | null;
  utilizationPercent: number | null;
  visualPercent: number;
  status: BudgetStatusLevel;
  statusLabel: string;
  statusPillClass: string;
}

/**
 * Evaluates the status level for a given utilization percentage.
 * Rules:
 * - < 80%: 'within-budget' ("On Track")
 * - 80% to 99.9%: 'approaching-limit' ("Approaching Limit")
 * - 100%: 'budget-reached' ("Budget Reached")
 * - > 100%: 'over-budget' ("Over Budget")
 */
export function evaluateBudgetStatus(
  spentPaise: number,
  allocatedPaise: number | null
): { status: BudgetStatusLevel; label: string; pillClass: string } {
  if (allocatedPaise === null) {
    return { status: 'no-budget', label: 'No Limit', pillClass: 'muted' };
  }
  if (allocatedPaise === 0) {
    if (spentPaise > 0) {
      return { status: 'over-budget', label: 'Over Limit', pillClass: 'danger' };
    }
    return { status: 'within-budget', label: 'Zero Limit', pillClass: 'neutral' };
  }

  const ratio = (spentPaise / allocatedPaise) * 100;
  if (ratio > 100) {
    return { status: 'over-budget', label: 'Over Budget', pillClass: 'danger' };
  }
  if (ratio >= 99.99) {
    return { status: 'budget-reached', label: '100% Reached', pillClass: 'warning' };
  }
  if (ratio >= 80) {
    return { status: 'approaching-limit', label: 'Approaching Limit', pillClass: 'warning' };
  }
  return { status: 'within-budget', label: 'Within Budget', pillClass: 'success' };
}

/**
 * Analyzes category spending against configured category budgets.
 */
export function analyzeCategoryBudgets(
  expenses: Expense[],
  categoryBudgets: Record<string, number> = {} // categoryName -> allocatedPaise
): CategoryBudgetAnalysis[] {
  // Aggregate spent paise by category
  const spentMap = new Map<string, number>();
  for (const exp of expenses) {
    const cur = spentMap.get(exp.category) || 0;
    spentMap.set(exp.category, cur + exp.amountInPaise);
  }

  const allCategoryNames = Array.from(
    new Set([...spentMap.keys(), ...Object.keys(categoryBudgets)])
  ).filter(Boolean);

  const results: CategoryBudgetAnalysis[] = [];

  for (const cat of allCategoryNames) {
    const spentPaise = spentMap.get(cat) || 0;
    const allocatedPaise =
      typeof categoryBudgets[cat] === 'number' ? categoryBudgets[cat] : null;

    let remainingPaise: number | null = null;
    let exceededPaise: number | null = null;
    let utilizationPercent: number | null = null;
    let visualPercent = 0;

    if (allocatedPaise !== null) {
      if (allocatedPaise > 0) {
        utilizationPercent = Math.round((spentPaise / allocatedPaise) * 1000) / 10;
        visualPercent = Math.min(100, Math.max(0, utilizationPercent));
      } else {
        // Zero budget
        utilizationPercent = spentPaise > 0 ? null : 0;
        visualPercent = spentPaise > 0 ? 100 : 0;
      }

      const diff = allocatedPaise - spentPaise;
      if (diff >= 0) {
        remainingPaise = diff;
        exceededPaise = null;
      } else {
        remainingPaise = null;
        exceededPaise = Math.abs(diff);
      }
    } else {
      // No budget configured
      visualPercent = 0;
    }

    const { status, label: statusLabel, pillClass: statusPillClass } = evaluateBudgetStatus(
      spentPaise,
      allocatedPaise
    );

    results.push({
      category: cat,
      spentPaise,
      allocatedPaise,
      remainingPaise,
      exceededPaise,
      utilizationPercent,
      visualPercent,
      status,
      statusLabel,
      statusPillClass,
    });
  }

  // Sort: over-budget first, then approaching-limit, then by highest spent
  const statusRank: Record<BudgetStatusLevel, number> = {
    'over-budget': 0,
    'budget-reached': 1,
    'approaching-limit': 2,
    'within-budget': 3,
    'no-budget': 4,
  };

  return results.sort((a, b) => {
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return b.spentPaise - a.spentPaise;
  });
}

export interface MonthlyBudgetComparison {
  currentBudgetPaise: number | null;
  previousBudgetPaise: number | null;
  budgetChangePaise: number | null;
  currentSpendingPaise: number;
  previousSpendingPaise: number;
  spendingChangePaise: number;
  currentUtilizationPercent: number | null;
  previousUtilizationPercent: number | null;
}

/**
 * Calculates comparison between current and previous month budget targets and actual utilization.
 */
export function calculateMonthlyBudgetComparison(
  currentBudgetPaise: number | null,
  previousBudgetPaise: number | null,
  currentExpenses: Expense[],
  previousExpenses: Expense[]
): MonthlyBudgetComparison {
  const currentSpendingPaise = sumExpenses(currentExpenses);
  const previousSpendingPaise = sumExpenses(previousExpenses);

  const budgetChangePaise =
    currentBudgetPaise !== null && previousBudgetPaise !== null
      ? currentBudgetPaise - previousBudgetPaise
      : null;

  const spendingChangePaise = currentSpendingPaise - previousSpendingPaise;

  const currentUtilizationPercent =
    currentBudgetPaise && currentBudgetPaise > 0
      ? Math.round((currentSpendingPaise / currentBudgetPaise) * 1000) / 10
      : null;

  const previousUtilizationPercent =
    previousBudgetPaise && previousBudgetPaise > 0
      ? Math.round((previousSpendingPaise / previousBudgetPaise) * 1000) / 10
      : null;

  return {
    currentBudgetPaise,
    previousBudgetPaise,
    budgetChangePaise,
    currentSpendingPaise,
    previousSpendingPaise,
    spendingChangePaise,
    currentUtilizationPercent,
    previousUtilizationPercent,
  };
}
