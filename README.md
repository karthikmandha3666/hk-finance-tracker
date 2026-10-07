# HK finance-tracker

> Mobile-first personal finance application engineered for frictionless daily expense recording with offline-first synchronization and ₹0 ongoing infrastructure cost.

---

## Current Stage

**Stage 2: Mobile Finance-Tracker UI Shell (Static Preview)**
- High-fidelity mobile dashboard shell with **HK** branding and **finance-tracker** subtitle.
- Financial overview metrics: Monthly Total Spending, Income, and Remaining Budget cards.
- Static sample transaction feed with category-coded icons.
- Add Expense view with quick category chips, date picker, payment method selector, and note field.
- Mobile bottom navigation bar (Home, Expenses, Add, Budgets, More) with tab routing.
- Pure UI demonstration shell (Zero database, zero Dexie/IndexedDB, zero backend API, zero persistence).

---

## Technology Stack

- **Framework**: React 19
- **Language**: TypeScript 5.7+
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
- [ ] **Stage 3**: Local-First Data Layer (Dexie.js / IndexedDB) & Working Expense Form
- [ ] **Stage 4**: Daily & Monthly Grouped Expense Views
- [ ] **Stage 5**: FastAPI Backend & Cloud Database Sync Engine
