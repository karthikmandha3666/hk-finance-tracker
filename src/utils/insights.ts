import { Expense } from '../types';
import { sumExpenses, formatPaiseToRupees } from './finance';

export interface MonthOverMonthInsight {
  diffPaise: number;
  percentChange: number | null;
  direction: 'increase' | 'decrease' | 'neutral';
  description: string;
}

/**
 * Calculates month-over-month comparison without division by zero.
 */
export function calculateMonthOverMonthInsight(
  currentMonthPaise: number,
  previousMonthPaise: number,
  prevMonthLabel = 'last month'
): MonthOverMonthInsight {
  const diffPaise = currentMonthPaise - previousMonthPaise;

  if (previousMonthPaise === 0) {
    if (currentMonthPaise === 0) {
      return {
        diffPaise: 0,
        percentChange: 0,
        direction: 'neutral',
        description: `No spending recorded in both months.`,
      };
    }
    return {
      diffPaise,
      percentChange: null,
      direction: 'increase',
      description: `New spending of ₹${formatPaiseToRupees(currentMonthPaise)} (no spending recorded in ${prevMonthLabel}).`,
    };
  }

  const pct = Math.round((Math.abs(diffPaise) / previousMonthPaise) * 1000) / 10;
  const direction: 'increase' | 'decrease' | 'neutral' =
    diffPaise > 0 ? 'increase' : diffPaise < 0 ? 'decrease' : 'neutral';

  const description =
    direction === 'neutral'
      ? `Spending is identical to ${prevMonthLabel}.`
      : direction === 'increase'
      ? `Spent ₹${formatPaiseToRupees(diffPaise)} (${pct}%) more than ${prevMonthLabel}.`
      : `Saved ₹${formatPaiseToRupees(Math.abs(diffPaise))} (${pct}%) compared to ${prevMonthLabel}.`;

  return {
    diffPaise,
    percentChange: pct,
    direction,
    description,
  };
}

export interface CategoryInsightItem {
  category: string;
  currentPaise: number;
  previousPaise: number;
  diffPaise: number;
  percentChange: number | null;
  sharePercent: number;
}

/**
 * Calculates category breakdown with comparison to previous month.
 */
export function calculateCategoryInsights(
  currentExpenses: Expense[],
  previousExpenses: Expense[]
): CategoryInsightItem[] {
  const currentTotal = sumExpenses(currentExpenses);
  const currentMap = new Map<string, number>();
  const prevMap = new Map<string, number>();

  for (const exp of currentExpenses) {
    const prev = currentMap.get(exp.category) || 0;
    currentMap.set(exp.category, prev + exp.amountInPaise);
  }

  for (const exp of previousExpenses) {
    const prev = prevMap.get(exp.category) || 0;
    prevMap.set(exp.category, prev + exp.amountInPaise);
  }

  const allCategories = Array.from(new Set([...currentMap.keys(), ...prevMap.keys()]));
  const results: CategoryInsightItem[] = [];

  for (const cat of allCategories) {
    const cur = currentMap.get(cat) || 0;
    const prev = prevMap.get(cat) || 0;
    if (cur === 0 && prev === 0) continue;

    const diffPaise = cur - prev;
    let percentChange: number | null = null;
    if (prev > 0) {
      percentChange = Math.round((Math.abs(diffPaise) / prev) * 1000) / 10;
    }

    const sharePercent = currentTotal > 0 ? Math.round((cur / currentTotal) * 1000) / 10 : 0;

    results.push({
      category: cat,
      currentPaise: cur,
      previousPaise: prev,
      diffPaise,
      percentChange,
      sharePercent,
    });
  }

  // Sort descending by current spending, then alphabetically
  return results.sort((a, b) => {
    if (b.currentPaise !== a.currentPaise) {
      return b.currentPaise - a.currentPaise;
    }
    return a.category.localeCompare(b.category);
  });
}

export interface UnusualSpendingFlag {
  category: string;
  currentPaise: number;
  historicalAveragePaise: number;
  diffPaise: number;
  percentAboveAverage: number;
  reason: string;
}

/**
 * Deterministically flags categories with unusually elevated spending
 * compared to prior periods.
 * Rules:
 * - Requires at least 2 distinct historical months with spending in that category.
 * - Current spending must be at least 30% higher than the historical average.
 * - The absolute increase must be at least ₹1,000 (100,000 paise) to prevent flagging trivial ₹10 jumps.
 */
export function detectUnusualCategorySpending(
  currentExpenses: Expense[],
  historicalExpenses: Expense[],
  currentMonthId: string,
  minThresholdPaise = 100000 // ₹1,000
): UnusualSpendingFlag[] {
  // Aggregate current month by category
  const currentCategoryMap = new Map<string, number>();
  for (const exp of currentExpenses) {
    const prev = currentCategoryMap.get(exp.category) || 0;
    currentCategoryMap.set(exp.category, prev + exp.amountInPaise);
  }

  // Filter historical expenses to strictly earlier months
  const priorExpenses = historicalExpenses.filter((e) => {
    const month = e.date ? e.date.slice(0, 7) : '';
    return month && month < currentMonthId;
  });

  // Group historical spending by category and month
  // category -> Map<monthId, totalPaise>
  const historicalMonthMap = new Map<string, Map<string, number>>();
  for (const exp of priorExpenses) {
    const month = exp.date.slice(0, 7);
    let catMonths = historicalMonthMap.get(exp.category);
    if (!catMonths) {
      catMonths = new Map();
      historicalMonthMap.set(exp.category, catMonths);
    }
    const prev = catMonths.get(month) || 0;
    catMonths.set(month, prev + exp.amountInPaise);
  }

  const flags: UnusualSpendingFlag[] = [];

  for (const [category, currentPaise] of currentCategoryMap.entries()) {
    const monthMap = historicalMonthMap.get(category);
    if (!monthMap || monthMap.size < 2) {
      // Suppress flag if insufficient historical periods exist (< 2 months)
      continue;
    }

    const monthTotals = Array.from(monthMap.values());
    const sumHistorical = monthTotals.reduce((a, b) => a + b, 0);
    const avgHistorical = Math.round(sumHistorical / monthTotals.length);

    if (avgHistorical <= 0) continue;

    const diffPaise = currentPaise - avgHistorical;
    if (diffPaise >= minThresholdPaise) {
      const pctAbove = Math.round((diffPaise / avgHistorical) * 1000) / 10;
      if (pctAbove >= 30) {
        flags.push({
          category,
          currentPaise,
          historicalAveragePaise: avgHistorical,
          diffPaise,
          percentAboveAverage: pctAbove,
          reason: `Current ₹${formatPaiseToRupees(currentPaise)} is ${pctAbove}% higher than your ${monthTotals.length}-month average of ₹${formatPaiseToRupees(avgHistorical)}.`,
        });
      }
    }
  }

  return flags.sort((a, b) => b.diffPaise - a.diffPaise);
}

export interface MonthlyTrendBar {
  monthId: string;
  label: string; // e.g. "Aug 2026"
  shortLabel: string; // e.g. "Aug"
  totalPaise: number;
  percentageOfPeak: number; // 0 to 100
  isCurrent: boolean;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Generates monthly trend bars across the past N months.
 */
export function calculateSpendingTrends(
  allExpenses: Expense[],
  currentMonthId: string,
  monthCount = 6
): MonthlyTrendBar[] {
  const [curY, curM] = currentMonthId.split('-').map(Number);
  if (isNaN(curY) || isNaN(curM)) return [];

  const targetMonths: { id: string; label: string; shortLabel: string; isCurrent: boolean }[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(curY, curM - 1 - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const id = `${y}-${m}`;
    targetMonths.push({
      id,
      label: `${MONTH_SHORT[d.getMonth()]} ${y}`,
      shortLabel: MONTH_SHORT[d.getMonth()],
      isCurrent: id === currentMonthId,
    });
  }

  // Aggregate expenses for target months
  const monthlyTotals = new Map<string, number>();
  for (const exp of allExpenses) {
    if (!exp.date) continue;
    const mId = exp.date.slice(0, 7);
    const prev = monthlyTotals.get(mId) || 0;
    monthlyTotals.set(mId, prev + exp.amountInPaise);
  }

  let peakPaise = 0;
  const bars = targetMonths.map((m) => {
    const totalPaise = monthlyTotals.get(m.id) || 0;
    if (totalPaise > peakPaise) peakPaise = totalPaise;
    return {
      monthId: m.id,
      label: m.label,
      shortLabel: m.shortLabel,
      totalPaise,
      percentageOfPeak: 0,
      isCurrent: m.isCurrent,
    };
  });

  // Calculate percentage of peak
  return bars.map((b) => ({
    ...b,
    percentageOfPeak: peakPaise > 0 ? Math.round((b.totalPaise / peakPaise) * 100) : 0,
  }));
}
