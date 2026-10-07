# HK finance-tracker

> Mobile-first personal finance application engineered for frictionless daily expense recording with offline-first synchronization and ₹0 ongoing infrastructure cost.

---

## Current Stage

**Stage 3: Local-First Expense Storage (Dexie.js / IndexedDB)**
- High-fidelity mobile dashboard with **HK** branding and **finance-tracker** subtitle.
- Local-first IndexedDB persistence powered by Dexie.js with zero network dependencies.
- Clean repository abstraction layer (`expenseRepository`) isolating storage from UI components.
- Exact monetary arithmetic stored in integer paise (`amountInPaise`) to prevent floating-point errors.
- Real-time reactivity via `dexie-react-hooks` (`useLiveQuery`).
- Dynamic client local date and rolling month selection (no UTC drift).
- Validated Add Expense workflow with controlled amount input, categories, payment methods, and notes.
- Real expense list on Home with dynamic Monthly Spending, Today's Spending, and Remaining Budget.
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
- [x] **Stage 3**: Local-First Data Layer (Dexie.js / IndexedDB) & Working Expense Form
- [ ] **Stage 4**: Daily & Monthly Grouped Expense Views
- [ ] **Stage 5**: FastAPI Backend & Cloud Database Sync Engine
