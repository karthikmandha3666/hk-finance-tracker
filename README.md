# HK finance-tracker

> Mobile-first personal finance application engineered for frictionless daily expense recording with offline-first synchronization and ₹0 ongoing infrastructure cost.

---

## Current Stage

**Stage 4: Persistent Monthly Income & Budget (Dexie.js / IndexedDB)**
- High-fidelity mobile dashboard with **HK** branding and **finance-tracker** subtitle.
- Local-first IndexedDB persistence powered by Dexie.js with zero network dependencies.
- Persistent Monthly Income and Monthly Budget surviving page reloads and browser restarts.
- Clean repository abstraction layers (`expenseRepository`, `financialSettingsRepository`) isolating storage from UI components.
- Exact monetary arithmetic stored in integer paise (`amountInPaise`, `incomeInPaise`, `budgetInPaise`) to prevent floating-point errors.
- Real-time reactivity via `dexie-react-hooks` (`useLiveQuery`).
- Non-destructive Dexie version upgrade (`version(2)`) ensuring existing expenses remain intact.
- Dynamic client local date and rolling month selection (no UTC drift) with full month isolation.
- Validated Edit Income & Budget modal with decimal support, boundary validation, and automatic paise conversion.
- Dynamic Home view calculations for Monthly Spending, Today's Spending, and Remaining Budget (`budgetInPaise - totalSpendingPaise`) with over-budget indicators.
- Root-level Error Boundary and full offline PWA caching.

---

## Technology Stack

- **Framework**: React 19
- **Language**: TypeScript 5.7+
- **Local Database**: Dexie.js (IndexedDB wrapper) & `dexie-react-hooks`
- **Build Tool**: Vite 6
- **PWA Tooling**: `vite-plugin-pwa` (Workbox)
- **Styling**: Modern Vanilla CSS (Mobile-first responsive design, safe-area insets, accessible contrast)
- **Package Manager**: npm

---

## Getting Started

### 1. Prerequisites
Ensure **Node.js** (v20+ or v22 LTS) and **npm** are available in your user profile environment.

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Locally (Development Server)
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser. Use your browser's Developer Tools (`F12` $\rightarrow$ Toggle Device Toolbar) to test responsive widths (360px, 375px, 390px, 430px).

### 4. Create Production Build
```bash
npm run build
```
Compiles TypeScript and creates optimized PWA production assets in `dist/`.

### 5. Preview Production Build
```bash
npm run preview
```

---

## Project Roadmap
- [x] **Stage 1**: Foundation & PWA setup
- [x] **Stage 2**: Mobile Finance-Tracker UI Shell (Static Placeholders)
- [x] **Stage 3**: Local-First Expense Storage (Dexie.js / IndexedDB)
- [x] **Stage 4**: Persistent Monthly Income & Budget
- [ ] **Stage 5**: Grouped Expense Views & Category Analytics
