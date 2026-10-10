# Spendly

> **Spend smart. Live better. Make every rupee count.**
>
> Version: **v0.1.0** — Local-First Personal Finance Progressive Web Application (PWA).

Live Deployment: [https://karthikmandha3666.github.io/hk-finance-tracker/](https://karthikmandha3666.github.io/hk-finance-tracker/)

---

## Overview

**Spendly** is a fast, privacy-focused, local-first personal finance tracker designed for mobile devices. Engineered with zero infrastructure cost and zero network dependencies, Spendly stores all your financial records directly on your device using IndexedDB.

---

## Core Features (v0.1.0)

- **Expense Management**: Fast expense recording, editing, and deletion with integer paise accuracy (no floating-point rounding errors).
- **Persistent Income & Budget**: Set monthly income and spending budgets. Visualize remaining budget and actual budget usage percentage (with over-budget alerts).
- **Category & Payment Method Customization**: Manage and personalize categories and payment methods with safe active/inactive lifecycles.
- **Upcoming & Recurring Obligations**: Track recurring bills and subscriptions (daily, weekly, monthly, yearly) with automatic due-date grouping and one-tap "Mark as Paid".
- **Loans & EMI Management**: Track liabilities (personal loans, car loans, home loans, credit card EMIs) with current outstanding balance, tenure, and reducing-balance EMI calculations.
- **Comprehensive Analytics Dashboard**:
  - Today's spending & monthly total
  - Month-over-Month (MoM) spending comparison
  - Net monthly savings & cashflow (income vs. actual expenses)
  - Visual category spending percentage breakdown
  - Recent transactions list
- **Permanent Navigation Hub**: Dedicated **More** hub allowing independent access to Upcoming Obligations, Loans & EMI, Categories, and Payment Methods from any screen.
- **Offline-First PWA**: Installable on Android, iOS, and desktop browsers with full offline functionality.

---

## Architecture & Data Safety

- **Local Storage**: All data is stored in the browser's IndexedDB via **Dexie.js**.
- **Data Privacy**: No data is ever transmitted to an external server or cloud provider.
- **Integer Paise Financial Model**: All currency calculations use exact integer paise (`1 Rupee = 100 Paise`), eliminating floating-point rounding discrepancies.
- **Local Calendar Accuracy**: Date logic operates strictly in local calendar time (`YYYY-MM-DD`), preventing UTC date-shifting defects.

---

## Technology Stack

- **Frontend**: React 19
- **Language**: TypeScript 5.7+
- **Build Tool**: Vite 6
- **Database**: Dexie.js 4.4+ (IndexedDB wrapper) & `dexie-react-hooks`
- **PWA Tooling**: `vite-plugin-pwa` (Workbox Service Worker precaching)
- **Styling**: Vanilla CSS (Mobile-first responsive architecture, safe-area insets, accessible contrast)
- **CI/CD**: GitHub Actions (`deploy.yml`)
- **Hosting**: GitHub Pages

---

## Current Behavior

- All data resides strictly in the local client device/browser storage.
- The application is fully functional offline once loaded or installed.
- Hosted statically as a project site on GitHub Pages.
- No remote backend server or database is required for operation.

---

## Current Limitations (v0.1.0)

Spendly v0.1.0 is intentionally a **local-first, device-centric MVP**. The following capabilities are planned for subsequent phases and are **not** present in v0.1.0:

- No cloud database
- No multi-device synchronization
- No user authentication or login system
- No remote backend APIs
- No bank API integrations
- No SMS transaction reading
- No automatic bank feed imports
- No multi-user account support

---

## Local Development

### Prerequisites
- **Node.js** v20+ or v22 LTS
- **npm** v10+

### Installation
```bash
npm ci
```

### Run Locally (Dev Server)
```bash
npm run dev
```
Open `http://localhost:5173/` or `http://localhost:5174/`.

### Build for Production
```bash
npm run build
```
Generates production assets and PWA service worker in `dist/`.

### Preview Production Build
```bash
npm run preview
```

---

## Data Management & Portability (Stage 10)

Spendly is local-first, meaning you have 100% control and ownership of your financial records. Under **Settings → Data & Backup**, you can backup, restore, export, and import your data at any time:

### 1. Full JSON Backup & Restore
- **Export Backup**: Packages all 6 data stores (Expenses, Categories, Payment Methods, Recurring Obligations, Loans/EMIs, and Monthly Income/Budgets) into an envelope JSON file.
- **Restore from Backup**: Validates the JSON file structure, schema version, and records, prompts with a summary of records to be restored, and performs an atomic database update.

### 2. Export Expenses to CSV (Excel)
- Generates a clean, RFC-4180 compliant CSV file of all your expense records.
- Includes UTF-8 Byte Order Mark (`\uFEFF`) so Indian Rupee characters and special notes display properly when opened in **Microsoft Excel**, **Google Sheets**, or **Apple Numbers**.
- Preserves exact integer paise accuracy converted to two-decimal rupees.
- Columns: `Date`, `Amount (INR)`, `Category`, `Payment Method`, `Note`.

### 3. Import Expenses from CSV
- Easily import historical expenses from other apps or bank spreadsheets.
- **Required Columns**: `Date` (YYYY-MM-DD), `Amount` (positive number), `Category`, `Payment Method`.
- **Optional Column**: `Note`.
- **Interactive Import Preview**:
  - Displays count of valid records, duplicate warnings, and invalid rows.
  - Automatically identifies duplicates matching existing transactions (by Date, Amount, Category, Payment Method, Note).
  - Offers one-click **Import Unique Only** or **Import All** options.
  - Automatically registers any new categories or payment methods so they immediately appear across filters and forms.

---

## License

MIT License. Designed and engineered by Karthik Mandha.
