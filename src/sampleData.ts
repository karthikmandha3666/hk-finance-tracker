import { MonthData } from './types';

// In-memory month definitions for Stage 2 UI navigation (zero fake expense records)
export const SAMPLE_MONTHS: MonthData[] = [
  {
    id: '2026-08',
    label: 'August 2026',
    shortLabel: 'Aug 2026',
    isCurrentMonth: false,
    expenses: [],
  },
  {
    id: '2026-09',
    label: 'September 2026',
    shortLabel: 'Sep 2026',
    isCurrentMonth: false,
    expenses: [],
  },
  {
    id: '2026-10',
    label: 'October 2026',
    shortLabel: 'Oct 2026',
    isCurrentMonth: true,
    expenses: [],
  },
];
