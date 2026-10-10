import { db } from '../db/db';
import { DashboardPreferences } from '../types';

export const PREFERENCES_RECORD_ID = 'dashboard_preferences';

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  id: PREFERENCES_RECORD_ID,
  showUpcomingObligations: true,
  showLoansSummary: true,
  updatedAt: '1970-01-01T00:00:00.000Z',
};

export const dashboardPreferencesRepository = {
  /**
   * Retrieves the current dashboard section visibility preferences.
   * If not set yet, returns the default (both sections ON).
   */
  async getPreferences(): Promise<DashboardPreferences> {
    const existing = await db.dashboardPreferences.get(PREFERENCES_RECORD_ID);
    if (existing) {
      return {
        id: PREFERENCES_RECORD_ID,
        showUpcomingObligations: existing.showUpcomingObligations !== undefined ? existing.showUpcomingObligations : true,
        showLoansSummary: existing.showLoansSummary !== undefined ? existing.showLoansSummary : true,
        updatedAt: existing.updatedAt || new Date().toISOString(),
      };
    }
    return { ...DEFAULT_DASHBOARD_PREFERENCES };
  },

  /**
   * Updates visibility preference for Upcoming Obligations section on Home dashboard.
   * Does NOT alter, hide, or deactivate any financial records.
   */
  async updateUpcomingVisibility(show: boolean): Promise<DashboardPreferences> {
    const existing = await this.getPreferences();
    const updated: DashboardPreferences = {
      ...existing,
      showUpcomingObligations: Boolean(show),
      updatedAt: new Date().toISOString(),
    };
    await db.dashboardPreferences.put(updated);
    return updated;
  },

  /**
   * Updates visibility preference for Loans & EMI Summary section on Home dashboard.
   * Does NOT alter, hide, or deactivate any financial records.
   */
  async updateLoansVisibility(show: boolean): Promise<DashboardPreferences> {
    const existing = await this.getPreferences();
    const updated: DashboardPreferences = {
      ...existing,
      showLoansSummary: Boolean(show),
      updatedAt: new Date().toISOString(),
    };
    await db.dashboardPreferences.put(updated);
    return updated;
  },

  /**
   * Saves partial or full preferences safely.
   */
  async savePreferences(prefs: Partial<Omit<DashboardPreferences, 'id'>>): Promise<DashboardPreferences> {
    const existing = await this.getPreferences();
    const updated: DashboardPreferences = {
      ...existing,
      ...prefs,
      id: PREFERENCES_RECORD_ID,
      updatedAt: new Date().toISOString(),
    };
    await db.dashboardPreferences.put(updated);
    return updated;
  },
};
