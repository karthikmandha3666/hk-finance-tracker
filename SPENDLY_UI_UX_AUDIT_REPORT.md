# Spendly UI/UX Audit & Redesign Specification Report

**Project:** Spendly Personal Finance Tracker (`hk-finance-tracker`)  
**Auditor Roles:** Senior Software Architect, Product Designer, Frontend Engineer & Mobile Specialist  
**Date:** October 11, 2026  
**Scope:** Complete screen-by-screen audit, UI pattern deduplication, design system token definition, responsive mobile ergonomics, and configuration consistency.

---

## 1. Executive Summary & Design Principles

Spendly is a local-first, privacy-focused PWA designed for everyday personal finance in Indian Rupees (₹). While the underlying engine possesses lossless integer paise calculations and atomic IndexedDB persistence, earlier iterations suffered from **visual uniformity and layout repetition**:
- Multiple screens reused identical high-level summary cards, diluting each screen's primary purpose.
- Categories, Payment Methods, Budgets, and Loans shared generic container patterns that failed to convey their functional domain.
- Transaction management lacked free-text search, sorting controls, and bulk selection.

### Core Redesign Principles
1. **Purpose-Driven Screen Identities:**
   - **Dashboard (Home):** Executive Financial Cockpit — high-level net worth context, trends, and quick actionable insights.
   - **Expenses (Ledger):** Transaction Workspace — search, multi-filter, sort, and batch execution.
   - **Budgets:** Control & Guardrails — utilization thresholds, category limits, and proactive over-budget warnings.
   - **Upcoming Payments:** Obligation Timeline — grouped by urgency (Overdue, Due Soon, Scheduled).
   - **Loans & EMI:** Liability Portfolio — remaining principal amortization, interest, and monthly debt commitment.
   - **Settings & Data Tools:** Mission Control — segregated user preferences and high-visibility data safety operations.
2. **Lossless Financial Communication:**
   - No color-only communication: status indicators always combine distinct semantic badges, labels, and text.
   - Precise integer paise presentation: proper Indian currency grouping (`en-IN`) with Lakh/Crore formatting.
3. **Ergonomic Mobile Touch Design:**
   - 44×44px minimum touch targets for all primary buttons and interactive chips.
   - Universal 16px font-size safeguards to permanently prevent iOS Safari auto-zoom.
   - Synchronous ref locks on destructive operations to eliminate mobile double-tap deadlocks.

---

## 2. Screen-by-Screen Audit Matrix

| Screen / View | Primary User Goal | Current Layout & Flaws | Proposed & Implemented Architectural Changes | Preserved Behaviors |
| :--- | :--- | :--- | :--- | :--- |
| **Home / Dashboard (`HomeView.tsx`)** | Grasp financial pulse in < 3 seconds | Replicated multiple isolated cards for totals; lacks multi-month visual trajectory; MoM was text-only. | **Executive Cockpit:** Unified monthly balance card; 6-month visual spending velocity bars; dynamic MoM insight badge; deterministic Unusual Spending alerts. | Integer paise math; home visibility toggles from IndexedDB; quick-action shortcuts. |
| **Expenses Ledger (`ExpensesView.tsx`)** | Search, filter, inspect, and manage historical transactions | Repeated identical "Total Spent" hero from Home; no free-text search; single delete only; delete hang on rapid clicks. | **Transaction Workspace:** Compact ledger header; live text search (note/category/payment/amount); sort selector; bulk selection mode with count and sum; idempotent atomic deletion. | RFC-4180 CSV export; category/payment filters; edit expense navigation; delete confirmation modal. |
| **Add / Edit Expense (`AddExpenseView.tsx`, `EditExpenseView.tsx`)** | Rapid friction-free expense logging | Nested form card; potential double-tap race on save/delete; modal lockup if DB write stalled. | **Focused Data Entry:** Clean form hierarchy; prominent currency input; synchronous `isDeletingRef` / `isSavingRef` locks; automatic recovery on duplicate delete. | 16px font-size iOS zoom guard; discard unsaved changes confirmation modal; date picker. |
| **Budgets (`BudgetsView.tsx`)** | Set spending limits and prevent overspending | Replicated income and cashflow cards from Home; lacked category budget tracking and status thresholds. | **Budget Guardrails:** Clear Overall Utilization Gauge with 4-tier threshold status (Within, Approaching, Reached, Over); category budget tracking with visual limit tracks and exceeded paise counters. | Shared `calculateBudgetMetrics` formula; edit limit modals; zero budget handling. |
| **Upcoming Payments (`UpcomingPaymentsView.tsx`)** | Track recurring obligations and prevent missed bills | Flat list of cards; no visual grouping by urgency. | **Chronological Timeline:** Visual categorization into Overdue, Due Soon (next 7 days), and Later; fast Mark as Paid with in-memory double-tap lock. | Recurrence advance algorithm; deactivation and deletion; category and payment method linkage. |
| **Loans & EMI (`LoansView.tsx`)** | Monitor debt commitments and amortization | Looked nearly identical to recurring payments. | **Liability Portfolio:** Total outstanding debt badge; monthly EMI burden stat; loan type chips (Home, Car, Personal, Education); close/reopen lifecycle. | Reducing-balance EMI formula; loan deactivation; balance updates. |
| **Settings & Data (`SettingsView.tsx`)** | Configure preferences and manage data backups | Long unstructured list mixing theme preferences with irreversible restore actions. | **Structured Utility Center:** Separated into Preferences, Financial Configuration, and Data Management; distinct dangerous action styling. | Atomic 6-store JSON backup/restore; CSV export and import preview with duplicate detection. |

---

## 3. Shared Design System & Token Architecture

The design system is implemented in `src/index.css` using CSS custom properties:

```css
:root {
  /* Brand Emerald Palette */
  --brand-primary: #059669;
  --brand-primary-hover: #10b981;
  --brand-dark: #064e3b;
  --brand-mint: #34d399;
  --brand-mint-light: #a7f3d0;
  
  /* Dark Mode Surface Hierarchy */
  --surface-bg: #090d16;
  --surface-card: #111827;
  --surface-card-hover: #1f2937;
  --surface-card-border: rgba(255, 255, 255, 0.08);
  --surface-input: #1e293b;
  
  /* Semantic Feedback Tokens */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #06b6d4;
  
  /* Typography & Sizing Tokens */
  --font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --touch-target-min: 44px;
  --border-radius-sm: 8px;
  --border-radius-md: 12px;
  --border-radius-lg: 16px;
  --border-radius-pill: 9999px;
}
```

---

## 4. Mobile Ergonomics & Viewport Safeguards

1. **iOS Safari Viewport Stability:**
   - Universal font-size `>= 16px` on `.form-input`, `.filter-select`, and search inputs.
   - `viewport-fit=cover`, `maximum-scale=1.0`, `user-scalable=no`.
   - Native notch padding using `env(safe-area-inset-top)` and home indicator clearance via `env(safe-area-inset-bottom)`.
2. **Touch-First Interactions:**
   - `touch-action: manipulation` across all buttons, chips, and table rows to eliminate 300ms double-tap delay.
   - Selection checkboxes with dedicated 44×44px hit-box targets.
3. **Horizontal Layout Containment:**
   - Container-level `overflow-x: clip` on `.mobile-shell`.
   - Grid templates utilizing `minmax(0, 1fr)` to prevent text blowout on 320px screens.

---

## 5. Implementation Roadmap Across Batches

- **Batch A:** Expense deletion concurrency mutex, idempotent repository operations, regression test suite. (COMPLETED)
- **Batch B:** Stage 11 Financial Insights: MoM comparisons, category trends, unusual spending detection, 6-month visual trends. (COMPLETED)
- **Batch C:** Stage 12 Smart Budget Management: Threshold status evaluation, category budget tracking, and monthly comparisons. (COMPLETED)
- **Batch D:** Stage 13 Transaction Management: Search, filtering, sorting, and bulk selection/deletion in ExpensesView. (NEXT)
- **Batch E:** UI/UX Redesign & Layout Differentiation in HomeView, BudgetsView, and ExpensesView. (NEXT)
- **Batch F:** Integrated QA, Automated Regression Suite, and Final Sign-off. (NEXT)
